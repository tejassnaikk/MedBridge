import { NextResponse } from 'next/server';

const REMS_DRUGS = [
  'clozapine', 'clozaril', 'isotretinoin', 'accutane', 'thalidomide', 'thalomid',
  'lenalidomide', 'revlimid', 'pomalidomide', 'pomalyst', 'mycophenolate', 'cellcept',
  'sodium oxybate', 'xyrem', 'mifepristone', 'mifeprex', 'buprenorphine', 'suboxone',
  'subutex', 'methadone', 'fentanyl', 'duragesic', 'oxycontin', 'oxycodone', 'hydrocodone',
  'vicodin', 'morphine', 'adderall', 'amphetamine', 'ritalin', 'methylphenidate',
  'ambien', 'zolpidem', 'xanax', 'alprazolam', 'valium', 'diazepam', 'ativan',
  'lorazepam', 'klonopin', 'clonazepam',
];

function getApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'your_key_here' || key.length < 10) return null;
  return key;
}

export async function POST(request) {
  try {
    const { image, mime, drug_name } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'image is required' }, { status: 400 });
    }

    const apiKey = getApiKey();

    if (!apiKey) {
      // Demo stub — auto-pass all checks
      return NextResponse.json({
        verified: true,
        stub: true,
        checks: {
          is_medication_package: true,
          drug_name_detected: drug_name,
          is_rems_controlled: false,
          expiry_date: null,
          expiry_valid: true,
          packaging_appears_sealed: true,
        },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const sixMonthsOut = new Date();
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
    const cutoffDate = sixMonthsOut.toISOString().split('T')[0];

    const prompt = `You are verifying a medication donation for a free medical clinic.

Today's date is ${today}. The donor claims this is: "${drug_name || 'unknown'}".

Examine this image of the medication packaging and answer each check carefully.

Controlled/REMS drugs that CANNOT be donated include (but are not limited to):
opioids (oxycodone, hydrocodone, morphine, fentanyl, buprenorphine, methadone),
benzodiazepines (xanax, valium, ativan, klonopin), stimulants (adderall, ritalin),
sleep aids (ambien/zolpidem), clozapine, isotretinoin/accutane, thalidomide,
lenalidomide, mifepristone, sodium oxybate.

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "is_medication_package": true or false,
  "drug_name_detected": "exact drug name visible on label, or null if not readable",
  "is_rems_controlled": true or false,
  "expiry_date": "date as YYYY-MM-DD if visible, or null",
  "expiry_valid": true if expiry date is after ${cutoffDate} OR if expiry date is not visible, false if expiry is before ${cutoffDate},
  "packaging_appears_sealed": true or false,
  "fail_reason": "specific reason if any check fails, empty string if all pass"
}`;

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
            { type: 'image_url', image_url: { url: `data:${mime || 'image/jpeg'};base64,${image}` } },
          ],
        }],
        max_tokens: 512,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[VERIFY DONATION] Groq error:', err.slice(0, 200));
      return NextResponse.json({
        verified: false,
        error: 'Verification service unavailable. Please try again.',
      });
    }

    const data = await res.json();
    const text = data.choices[0].message.content.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ verified: false, error: 'Unexpected response from verification service.' });
    }

    const checks = JSON.parse(match[0]);
    console.log('[VERIFY DONATION]', JSON.stringify(checks));

    if (!checks.is_medication_package) {
      return NextResponse.json({ verified: false, failed_gate: 'package', reason: 'This does not appear to be a medication package. Please upload a clear photo of the bottle, box, or blister pack.' });
    }
    if (checks.is_rems_controlled) {
      return NextResponse.json({ verified: false, failed_gate: 'rems', reason: `This medication appears to be a controlled substance or on the FDA REMS restricted list and cannot be donated.` });
    }
    if (checks.expiry_valid === false) {
      return NextResponse.json({ verified: false, failed_gate: 'expiry', reason: `This medication expires on ${checks.expiry_date}, which is less than 6 months away. It is not eligible for donation.` });
    }
    if (!checks.packaging_appears_sealed) {
      return NextResponse.json({ verified: false, failed_gate: 'packaging', reason: 'The packaging does not appear to be original or sealed. Opened or repackaged medications cannot be donated.' });
    }

    return NextResponse.json({ verified: true, checks });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
