import { NextResponse } from 'next/server';
import { dbInsert } from '../../../lib/db.js';
import { runMatchEngine } from '../../../lib/match.js';

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
  const lower = name.toLowerCase();
  return REMS_DRUGS.some(r => lower.includes(r));
}

function isExpiringSoon(date) {
  const expiry = new Date(date);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + 6);
  return expiry < cutoff;
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('x-clinic-auth');
    if (authHeader !== process.env.CLINIC_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { drug_name, strength, form, quantity, expiry_date, clinic_id } = await request.json();
    if (!drug_name || !strength || !quantity || !expiry_date || !clinic_id) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (isREMS(drug_name)) {
      return NextResponse.json({
        error: `${drug_name} is on the FDA REMS restricted list and cannot be donated through MedBridge.`,
        disposal: 'https://www.deadiversion.usdoj.gov/drug_disposal/takeback/',
      }, { status: 422 });
    }

    if (isExpiringSoon(expiry_date)) {
      return NextResponse.json({
        error: 'Medications must have at least 6 months until expiry to be accepted.',
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
      status: 'available',
      date_received: new Date().toISOString(),
    });

    runMatchEngine(item.id).then(r => {
      console.log(`Match engine for inventory #${item.id}:`, r);
    }).catch(console.error);

    return NextResponse.json({ success: true, inventory_id: item.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
