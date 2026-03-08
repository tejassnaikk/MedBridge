import { NextResponse } from 'next/server';
import { dbAll } from '../../../lib/db.js';
import { expireStaleReservations } from '../../../lib/match.js';

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'medbridge2024';

export async function GET(request) {
  const authHeader = request.headers.get('x-clinic-auth');
  if (authHeader !== ADMIN_PASS) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clinic_id = parseInt(searchParams.get('clinic_id'));
  if (!clinic_id) return NextResponse.json({ error: 'clinic_id required' }, { status: 400 });

  expireStaleReservations();

  const inventory = dbAll('inventory', i => i.clinic_id === clinic_id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const clinics = dbAll('clinics', c => c.is_verified);

  // Waitlist demand counts
  const waiting = dbAll('waitlist', w => w.status === 'waiting');
  const countMap = {};
  waiting.forEach(w => {
    const key = `${w.drug_name}||${w.strength}`;
    countMap[key] = (countMap[key] || { drug_name: w.drug_name, strength: w.strength, count: 0 });
    countMap[key].count++;
  });
  const waitlistCounts = Object.values(countMap);

  // Enrich reserved inventory rows with quantity_requested from linked waitlist entry
  const allWaitlist = dbAll('waitlist');
  const reservedMap = {};
  allWaitlist.filter(w => w.reserved_inventory_id && (w.status === 'notified' || w.status === 'fulfilled')).forEach(w => {
    reservedMap[w.reserved_inventory_id] = w;
  });

  const enrichedInventory = inventory.map(item => ({
    ...item,
    quantity_requested: reservedMap[item.id]?.quantity_requested || null,
    patient_email: item.patient_email || reservedMap[item.id]?.email || null,
  }));

  // Dispensed transactions: fulfilled waitlist entries for this clinic's inventory
  const clinicInventoryIds = new Set(inventory.map(i => i.id));
  const transactions = allWaitlist
    .filter(w => w.status === 'fulfilled' && clinicInventoryIds.has(w.reserved_inventory_id))
    .map(w => {
      const inv = inventory.find(i => i.id === w.reserved_inventory_id);
      return {
        inventory_id: w.reserved_inventory_id,
        drug_name: inv?.drug_name || w.drug_name,
        strength: inv?.strength || w.strength,
        qty_dispensed: inv?.dispensed_quantity || w.quantity_requested || inv?.quantity || '—',
        patient_email: w.email,
        dispensed_at: inv?.dispensed_at || null,
      };
    })
    .sort((a, b) => new Date(b.dispensed_at) - new Date(a.dispensed_at));

  // Pending donations awaiting physical inspection at this clinic
  const pendingDonations = dbAll('inventory', i => i.clinic_id === clinic_id && i.status === 'pending')
    .sort((a, b) => new Date(b.date_received) - new Date(a.date_received));

  return NextResponse.json({ inventory: enrichedInventory, clinics, waitlistCounts, transactions, pendingDonations });
}
