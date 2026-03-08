import { NextResponse } from 'next/server';
import { dbAll } from '../../../lib/db.js';
import { expireStaleReservations } from '../../../lib/match.js';

export async function GET(request) {
  const authHeader = request.headers.get('x-clinic-auth');
  if (authHeader !== process.env.CLINIC_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clinic_id = parseInt(searchParams.get('clinic_id'));
  if (!clinic_id) return NextResponse.json({ error: 'clinic_id required' }, { status: 400 });

  expireStaleReservations();

  const inventory = dbAll('inventory', i => i.clinic_id === clinic_id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const clinics = dbAll('clinics', c => c.is_verified);

  const waiting = dbAll('waitlist', w => w.status === 'waiting');
  const countMap = {};
  waiting.forEach(w => {
    const key = `${w.drug_name}||${w.strength}`;
    countMap[key] = (countMap[key] || { drug_name: w.drug_name, strength: w.strength, count: 0 });
    countMap[key].count++;
  });
  const waitlistCounts = Object.values(countMap);

  return NextResponse.json({ inventory, clinics, waitlistCounts });
}
