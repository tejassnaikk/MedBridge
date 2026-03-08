import { NextResponse } from 'next/server';
import { dbAll } from '../../../lib/db.js';

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'medbridge2024';

export async function GET(request) {
  if (request.headers.get('x-clinic-auth') !== ADMIN_PASS) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const inventory = dbAll('inventory');
  const waitlist  = dbAll('waitlist');
  const clinics   = dbAll('clinics');
  const clinicMap = Object.fromEntries(clinics.map(c => [c.id, c.name]));

  const events = [];

  // Donations — split by status so pending items don't appear as donated
  inventory.forEach(i => {
    if (i.status === 'pending') {
      events.push({
        time: i.date_received || i.created_at,
        type: 'pending',
        label: `Drop-off logged (awaiting inspection): ${i.drug_name} ${i.strength} × ${i.quantity}`,
        sub: clinicMap[i.clinic_id] || `Clinic #${i.clinic_id}`,
        status: i.status,
      });
    } else if (i.status === 'rejected') {
      events.push({
        time: i.approved_at || i.date_received || i.created_at,
        type: 'rejected',
        label: `Donation rejected: ${i.drug_name} ${i.strength} × ${i.quantity}`,
        sub: clinicMap[i.clinic_id] || `Clinic #${i.clinic_id}`,
        status: i.status,
      });
    } else {
      // available, reserved, dispensed — all were approved by pharmacist
      events.push({
        time: i.approved_at || i.date_received || i.created_at,
        type: 'donation',
        label: `Donation approved: ${i.drug_name} ${i.strength} × ${i.quantity}`,
        sub: clinicMap[i.clinic_id] || `Clinic #${i.clinic_id}`,
        status: i.status,
      });
    }
  });

  // Waitlist joins
  waitlist.forEach(w => {
    events.push({
      time: w.created_at,
      type: 'waitlist',
      label: `Waitlist: ${w.drug_name} ${w.strength}`,
      sub: w.email || 'phone only' ,
      status: w.status,
    });
  });

  // Matches (notified — reservation made, awaiting pickup)
  waitlist.filter(w => w.status === 'notified').forEach(w => {
    const item = w.reserved_inventory_id ? inventory.find(i => i.id === w.reserved_inventory_id) : null;
    const clinic = item ? clinicMap[item.clinic_id] : null;
    events.push({
      time: w.notified_at,
      type: 'match',
      label: `Reserved: ${w.drug_name} ${w.strength} × ${w.quantity_requested || '?'}`,
      sub: clinic || 'Unknown clinic',
      status: w.status,
    });
  });

  // Pickups — fulfilled waitlist entries, use dispensed_at from inventory for accurate timestamp
  waitlist.filter(w => w.status === 'fulfilled').forEach(w => {
    const item = w.reserved_inventory_id ? inventory.find(i => i.id === w.reserved_inventory_id) : null;
    const clinic = item ? clinicMap[item.clinic_id] : null;
    events.push({
      time: item?.dispensed_at || w.notified_at,
      type: 'pickup',
      label: `Dispensed: ${w.drug_name} ${w.strength} × ${item?.dispensed_quantity ?? w.quantity_requested ?? '?'}`,
      sub: clinic || 'Unknown clinic',
      status: 'fulfilled',
    });
  });

  events.sort((a, b) => new Date(b.time) - new Date(a.time));

  return NextResponse.json({ events: events.slice(0, 60) });
}
