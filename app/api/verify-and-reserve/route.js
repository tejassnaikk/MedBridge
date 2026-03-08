import { NextResponse } from 'next/server';
import { dbGet, dbUpdate, dbInsert } from '../../../lib/db.js';
import { sendReservationConfirmationEmail } from '../../../lib/email.js';

function getApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'your_key_here' || key.length < 10) return null;
  return key;
}

async function callGroq(apiKey, prompt, imageBase64, imageMime) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 512,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices[0].message.content.trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Unexpected model response: ${text.slice(0, 120)}`);
  return JSON.parse(match[0]);
}

async function verifyPrescription(apiKey, imageBase64, imageMime, drugName) {
  const prompt = `You are a strict document verifier for a free medical clinic.

Examine this image carefully and determine if it is a VALID PRESCRIPTION document.

A valid prescription MUST satisfy ALL of the following:
1. It must visually look like a prescription slip, printed Rx form, or doctor's prescription — NOT a photo ID, general paperwork, or unrelated image
2. A prescriber name (doctor/physician) with contact info or DEA number must be visible
3. A patient name must be visible
4. The medication name must be present — check if it mentions "${drugName}" (allow brand/generic variants and partial matches)
5. A dosage or strength must be present

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "is_prescription": true or false,
  "has_prescriber": true or false,
  "has_patient_name": true or false,
  "drug_matches": true or false,
  "has_dosage": true or false,
  "fail_reason": "specific reason if any check fails, empty string if all pass"
}`;

  return callGroq(apiKey, prompt, imageBase64, imageMime);
}

async function verifyStateId(apiKey, imageBase64, imageMime) {
  const prompt = `You are a strict document verifier for a free medical clinic.

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
}`;

  return callGroq(apiKey, prompt, imageBase64, imageMime);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { inventory_id, email, quantity_requested, rx_image, rx_mime, id_image, id_mime } = body;

    if (!inventory_id || !email) {
      return NextResponse.json({ error: 'inventory_id and email are required' }, { status: 400 });
    }
    if (!rx_image || !id_image) {
      return NextResponse.json({ error: 'Both prescription and state ID images are required' }, { status: 400 });
    }

    const item = dbGet('inventory', inventory_id);
    if (!item || item.status !== 'available') {
      return NextResponse.json({ error: 'This item is no longer available' }, { status: 409 });
    }

    const apiKey = getApiKey();

    if (!apiKey) {
      console.log('🔍 [VERIFY STUB] No Groq API key — demo mode auto-approve');
      return reserveAndRespond({ item, email, quantity_requested, stub: true });
    }

    // Step 1: Verify prescription first — if this fails we know exactly which doc
    let rxResult;
    try {
      rxResult = await verifyPrescription(apiKey, rx_image, rx_mime || 'image/jpeg', item.drug_name);
      console.log('🔍 [VERIFY RX]', JSON.stringify(rxResult));
    } catch (err) {
      console.error('🔍 [VERIFY RX ERROR]', err.message);
      return NextResponse.json({
        verified: false,
        failed_doc: 'rx',
        reason: 'Could not verify your prescription — please ensure the image is clear and try again.',
      });
    }

    if (!rxResult.is_prescription) {
      return NextResponse.json({ verified: false, failed_doc: 'rx', reason: 'This does not appear to be a prescription. Please upload a clear photo of your prescription slip.' });
    }
    if (!rxResult.has_prescriber) {
      return NextResponse.json({ verified: false, failed_doc: 'rx', reason: 'Prescriber name or contact information is missing from the prescription.' });
    }
    if (!rxResult.has_patient_name) {
      return NextResponse.json({ verified: false, failed_doc: 'rx', reason: 'Patient name is not visible on the prescription.' });
    }
    if (!rxResult.drug_matches) {
      return NextResponse.json({ verified: false, failed_doc: 'rx', reason: `This prescription does not appear to be for ${item.drug_name} ${item.strength}. Please upload the correct prescription.` });
    }

    // Step 2: Verify state ID
    let idResult;
    try {
      idResult = await verifyStateId(apiKey, id_image, id_mime || 'image/jpeg');
      console.log('🔍 [VERIFY ID]', JSON.stringify(idResult));
    } catch (err) {
      console.error('🔍 [VERIFY ID ERROR]', err.message);
      return NextResponse.json({
        verified: false,
        failed_doc: 'id',
        reason: 'Could not verify your state ID — please ensure the image is clear and try again.',
      });
    }

    if (!idResult.is_government_id) {
      return NextResponse.json({ verified: false, failed_doc: 'id', reason: "This does not appear to be a government-issued photo ID. Please upload your driver's license or state ID card — not a prescription or other document." });
    }
    if (!idResult.has_photo) {
      return NextResponse.json({ verified: false, failed_doc: 'id', reason: 'No photograph of your face is visible on the ID.' });
    }
    if (!idResult.has_dob) {
      return NextResponse.json({ verified: false, failed_doc: 'id', reason: 'Date of birth is not visible on the ID.' });
    }

    return reserveAndRespond({ item, email, quantity_requested, stub: false });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function reserveAndRespond({ item, email, quantity_requested, stub }) {
  const requested = Math.min(Math.max(parseInt(quantity_requested) || 7, 7), 90);
  const qty = Math.min(requested, item.quantity);

  const waitlistEntry = dbInsert('waitlist', {
    drug_name: item.drug_name,
    strength: item.strength,
    zip_code: '',
    email: email.trim().toLowerCase(),
    quantity_requested: qty,
    has_rx: true,
    status: 'notified',
    notified_at: new Date().toISOString(),
    reserved_inventory_id: item.id,
    verified_at: new Date().toISOString(),
  });

  dbUpdate('inventory', item.id, { status: 'reserved' });

  const clinic = dbGet('clinics', item.clinic_id);
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
  const todayHours = clinic?.hours?.[today] || 'Call to confirm hours';

  // Fire confirmation email — don't await so it doesn't block the response
  sendReservationConfirmationEmail(email.trim().toLowerCase(), {
    drugName: item.drug_name,
    strength: item.strength,
    clinicName: clinic?.name || 'Your clinic',
    clinicAddress: clinic ? `${clinic.address}, ${clinic.city}` : '',
    todayHours,
    qty,
    reservationId: waitlistEntry.id,
  }).catch(err => console.error('📋 [RESERVATION EMAIL FAILED]', err.message));

  return NextResponse.json({
    verified: true,
    reservation_id: waitlistEntry.id,
    inventory_id: item.id,
    clinic_name: clinic?.name,
    clinic_address: clinic ? `${clinic.address}, ${clinic.city}` : '',
    today_hours: todayHours,
    drug_name: item.drug_name,
    strength: item.strength,
    qty_reserved: qty,
    stub,
  });
}
