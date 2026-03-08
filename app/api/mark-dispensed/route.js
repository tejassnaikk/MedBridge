import { NextResponse } from 'next/server';
import { dbUpdate, dbAll } from '../../../lib/db.js';

export async function POST(request) {
  const authHeader = request.headers.get('x-clinic-auth');
  if (authHeader !== process.env.CLINIC_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { inventory_id } = await request.json();
  if (!inventory_id) return NextResponse.json({ error: 'inventory_id required' }, { status: 400 });

  dbUpdate('inventory', inventory_id, { status: 'dispensed' });

  const notified = dbAll('waitlist', w =>
    w.reserved_inventory_id === inventory_id && w.status === 'notified'
  );
  notified.forEach(w => dbUpdate('waitlist', w.id, { status: 'fulfilled' }));

  return NextResponse.json({ success: true });
}
