import { NextResponse } from 'next/server';
import { dbUpdate, dbAll, dbGet } from '../../../lib/db.js';

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'medbridge2024';

export async function POST(request) {
  const authHeader = request.headers.get('x-clinic-auth');
  if (authHeader !== ADMIN_PASS) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const inventory_id = parseInt(body.inventory_id);
  if (!inventory_id) return NextResponse.json({ error: 'inventory_id required' }, { status: 400 });

  const item = dbGet('inventory', inventory_id);
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  if (item.status !== 'reserved') return NextResponse.json({ error: 'Item is not in reserved state' }, { status: 409 });

  // Find the notified waitlist entry linked to this reservation
  const waitlistEntry = dbAll('waitlist', w =>
    w.reserved_inventory_id === inventory_id && w.status === 'notified'
  )[0] || null;

  const qtyDispensed = waitlistEntry?.quantity_requested
    ? Math.min(parseInt(waitlistEntry.quantity_requested), item.quantity)
    : item.quantity;

  const remaining = item.quantity - qtyDispensed;

  const dispensedFields = {
    dispensed_quantity: qtyDispensed,
    dispensed_at: new Date().toISOString(),
    patient_email: waitlistEntry?.email || null,
  };

  if (remaining > 0) {
    // Partial dispense — put remaining units back as available
    dbUpdate('inventory', inventory_id, {
      ...dispensedFields,
      status: 'available',
      quantity: remaining,
    });
    // Re-run match engine so the next waiting patient gets notified
    const { runMatchEngine } = await import('../../../lib/match.js');
    runMatchEngine(inventory_id).catch(() => {});
  } else {
    dbUpdate('inventory', inventory_id, { ...dispensedFields, status: 'dispensed' });
  }

  // Mark waitlist entry as fulfilled
  if (waitlistEntry) {
    dbUpdate('waitlist', waitlistEntry.id, { status: 'fulfilled' });
  }

  return NextResponse.json({ success: true, qty_dispensed: qtyDispensed, remaining });
}
