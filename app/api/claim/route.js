import { NextResponse } from 'next/server';
import { dbGet, dbUpdate, dbAll } from '../../../lib/db.js';

export async function POST(request) {
  try {
    const { waitlist_id } = await request.json();
    if (!waitlist_id) return NextResponse.json({ error: 'waitlist_id required' }, { status: 400 });

    const entry = dbGet('waitlist', parseInt(waitlist_id));
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (entry.status === 'fulfilled') {
      return NextResponse.json({ already_claimed: true });
    }
    if (entry.status !== 'notified') {
      return NextResponse.json({ error: 'This reservation is no longer active' }, { status: 400 });
    }

    // Mark waitlist entry fulfilled
    dbUpdate('waitlist', entry.id, { status: 'fulfilled' });

    // Mark inventory dispensed
    if (entry.reserved_inventory_id) {
      dbUpdate('inventory', entry.reserved_inventory_id, { status: 'dispensed' });
    }

    const item = entry.reserved_inventory_id
      ? dbGet('inventory', entry.reserved_inventory_id)
      : null;
    const clinic = item ? dbAll('clinics', c => c.id === item.clinic_id)[0] : null;

    return NextResponse.json({
      success: true,
      drug_name: item?.drug_name,
      strength: item?.strength,
      clinic_name: clinic?.name,
      clinic_address: clinic ? `${clinic.address}, ${clinic.city}` : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const entry = dbGet('waitlist', id);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const item = entry.reserved_inventory_id
    ? dbGet('inventory', entry.reserved_inventory_id)
    : null;
  const clinic = item ? dbAll('clinics', c => c.id === item.clinic_id)[0] : null;

  return NextResponse.json({
    status: entry.status,
    drug_name: item?.drug_name || entry.drug_name,
    strength: item?.strength || entry.strength,
    clinic_name: clinic?.name,
    clinic_address: clinic ? `${clinic.address}, ${clinic.city}` : null,
    clinic_hours: clinic?.hours,
    notified_at: entry.notified_at,
  });
}
