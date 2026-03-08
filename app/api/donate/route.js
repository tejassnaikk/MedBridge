import { NextResponse } from 'next/server';
import { dbInsert } from '../../../lib/db.js';


const REMS_DRUGS = [
  'clozapine', 'clozaril', 'isotretinoin', 'accutane', 'thalidomide', 'thalomid',
  'lenalidomide', 'revlimid', 'pomalidomide', 'pomalyst', 'mycophenolate', 'cellcept',
  'sodium oxybate', 'xyrem', 'mifepristone', 'mifeprex', 'buprenorphine', 'suboxone',
  'subutex', 'methadone', 'fentanyl', 'duragesic', 'oxycontin', 'oxycodone', 'hydrocodone',
  'vicodin', 'morphine', 'adderall', 'amphetamine', 'ritalin', 'methylphenidate',
  'ambien', 'zolpidem', 'xanax', 'alprazolam', 'valium', 'diazepam', 'ativan',
  'lorazepam', 'klonopin', 'clonazepam',
];

function isREMS(name) {
  return REMS_DRUGS.some(r => name.toLowerCase().includes(r));
}

function isExpiringSoon(date) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + 6);
  return new Date(date) < cutoff;
}

export async function POST(request) {
  try {
    const { drug_name, strength, form, quantity, expiry_date, clinic_id } = await request.json();

    if (!drug_name || !strength || !quantity || !expiry_date || !clinic_id) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const qty = parseInt(quantity);
    if (qty < 20) {
      return NextResponse.json({ error: 'Minimum donation quantity is 20 units.' }, { status: 422 });
    }
    if (qty > 500) {
      return NextResponse.json({ error: 'Maximum donation quantity is 500 units per submission.' }, { status: 422 });
    }

    if (isREMS(drug_name)) {
      return NextResponse.json({
        error: `${drug_name} is on the FDA REMS restricted list and cannot be donated.`,
        disposal: 'https://www.deadiversion.usdoj.gov/drug_disposal/takeback/',
      }, { status: 422 });
    }

    if (isExpiringSoon(expiry_date)) {
      return NextResponse.json({
        error: 'Medication must have at least 6 months until expiry.',
      }, { status: 422 });
    }

    const normalizedName = drug_name.trim().replace(/\b\w/g, c => c.toUpperCase());

    const item = dbInsert('inventory', {
      drug_name: normalizedName,
      strength: strength.trim(),
      form: form || 'tablet',
      quantity: parseInt(quantity),
      expiry_date,
      clinic_id: parseInt(clinic_id),
      status: 'pending',
      date_received: new Date().toISOString(),
      donated_via: 'donor_form',
    });

    return NextResponse.json({ success: true, inventory_id: item.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
