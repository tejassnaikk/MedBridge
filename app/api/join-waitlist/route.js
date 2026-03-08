import { NextResponse } from 'next/server';
import { dbInsert, dbAll } from '../../../lib/db.js';

function getApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'your_key_here' || key.length < 10) return null;
  return key;
}

async function callGroq(apiKey, prompt, imageBase64, imageMime) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
      ]}],
      max_tokens: 512,
      temperature: 0,
    }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Groq API error ${res.status}: ${err.slice(0, 200)}`); }
  const data = await res.json();
  const text = data.choices[0].message.content.trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Unexpected model response: ${text.slice(0, 120)}`);
  return JSON.parse(match[0]);
}

export async function POST(request) {
  try {
    const { drug_name, strength, zip_code, email, quantity_requested, rx_image, rx_mime, id_image, id_mime } = await request.json();

    if (!drug_name || !zip_code || !email) {
      return NextResponse.json({ error: 'drug_name, zip_code, and email are required' }, { status: 400 });
    }
    if (!rx_image || !id_image) {
      return NextResponse.json({ error: 'Both prescription and state ID images are required' }, { status: 400 });
    }

    const qty = Math.min(Math.max(parseInt(quantity_requested) || 7, 7), 90);

    const apiKey = getApiKey();

    if (apiKey) {
      // Step 1: Verify prescription
      let rxResult;
      try {
        rxResult = await callGroq(apiKey, `You are a strict document verifier for a free medical clinic.

Examine this image carefully and determine if it is a VALID PRESCRIPTION document.

A valid prescription MUST satisfy ALL of the following:
1. It must visually look like a prescription slip, printed Rx form, or doctor's prescription — NOT a photo ID, general paperwork, or unrelated image
2. A prescriber name (doctor/physician) with contact info or DEA number must be visible
3. A patient name must be visible
4. The medication name must be present — check if it mentions "${drug_name}" (allow brand/generic variants and partial matches)
5. A dosage or strength must be present

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "is_prescription": true or false,
  "has_prescriber": true or false,
  "has_patient_name": true or false,
  "drug_matches": true or false,
  "has_dosage": true or false,
  "fail_reason": "specific reason if any check fails, empty string if all pass"
}`, rx_image, rx_mime || 'image/jpeg');
      } catch (err) {
        console.error('[WAITLIST VERIFY RX ERROR]', err.message);
        return NextResponse.json({ verified: false, failed_doc: 'rx', reason: 'Could not verify your prescription — please ensure the image is clear and try again.' });
      }

      if (!rxResult.is_prescription) return NextResponse.json({ verified: false, failed_doc: 'rx', reason: 'This does not appear to be a prescription. Please upload a clear photo of your prescription slip.' });
      if (!rxResult.has_prescriber) return NextResponse.json({ verified: false, failed_doc: 'rx', reason: 'Prescriber name or contact information is missing from the prescription.' });
      if (!rxResult.has_patient_name) return NextResponse.json({ verified: false, failed_doc: 'rx', reason: 'Patient name is not visible on the prescription.' });
      if (!rxResult.drug_matches) return NextResponse.json({ verified: false, failed_doc: 'rx', reason: `This prescription does not appear to be for ${drug_name}. Please upload the correct prescription.` });

      // Step 2: Verify state ID
      let idResult;
      try {
        idResult = await callGroq(apiKey, `You are a strict document verifier for a free medical clinic.

Examine this image carefully and determine if it is a VALID GOVERNMENT-ISSUED PHOTO ID (driver's license or state identification card).

A valid government-issued photo ID MUST satisfy ALL of the following:
1. It must visually look like a physical ID card or driver's license — NOT a prescription, medical form, paper document, or anything else
2. A photograph of a human face must be clearly visible on the card
3. The cardholder's full name must be printed on it
4. A date of birth must be present
5. A state name, government seal, or issuing authority must be visible

If this image is a prescription, medical document, paper, or anything other than a physical ID card, it MUST fail.

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "is_government_id": true or false,
  "has_photo": true or false,
  "has_name": true or false,
  "has_dob": true or false,
  "has_state_seal": true or false,
  "fail_reason": "specific reason if any check fails, empty string if all pass"
}`, id_image, id_mime || 'image/jpeg');
      } catch (err) {
        console.error('[WAITLIST VERIFY ID ERROR]', err.message);
        return NextResponse.json({ verified: false, failed_doc: 'id', reason: 'Could not verify your state ID — please ensure the image is clear and try again.' });
      }

      if (!idResult.is_government_id) return NextResponse.json({ verified: false, failed_doc: 'id', reason: "This does not appear to be a government-issued photo ID. Please upload your driver's license or state ID card." });
      if (!idResult.has_photo) return NextResponse.json({ verified: false, failed_doc: 'id', reason: 'No photograph of your face is visible on the ID.' });
      if (!idResult.has_dob) return NextResponse.json({ verified: false, failed_doc: 'id', reason: 'Date of birth is not visible on the ID.' });
    }

    const entry = dbInsert('waitlist', {
      drug_name: drug_name.trim(),
      strength: (strength || '').trim(),
      zip_code: zip_code.trim(),
      email: email.trim().toLowerCase(),
      quantity_requested: qty,
      has_rx: true,
      status: 'waiting',
      notified_at: null,
      reserved_inventory_id: null,
      verified_at: apiKey ? new Date().toISOString() : null,
    });

    const drugLower = drug_name.toLowerCase().trim();
    const normStrength = (strength || '').toLowerCase().replace(/\s*(mg|mcg|ml|g|iu|units?|%)\s*/g, '$1').trim();
    const available = dbAll('inventory', i => {
      if (i.status !== 'available') return false;
      const iDrug = i.drug_name.toLowerCase().trim();
      if (!iDrug.includes(drugLower) && !drugLower.includes(iDrug)) return false;
      if (normStrength) {
        const iStr = i.strength.toLowerCase().replace(/\s*(mg|mcg|ml|g|iu|units?|%)\s*/g, '$1').trim();
        if (iStr !== normStrength) return false;
      }
      return true;
    });

    if (available.length > 0) {
      const { runMatchEngine } = await import('../../../lib/match.js');
      runMatchEngine(available[0].id).catch(console.error);
    }

    const position = dbAll('waitlist', w =>
      w.status === 'waiting' && w.drug_name.toLowerCase().includes(drugLower) && w.id <= entry.id
    ).length;

    return NextResponse.json({ success: true, verified: true, waitlist_id: entry.id, position });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
