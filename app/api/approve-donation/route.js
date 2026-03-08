import { NextResponse } from 'next/server';
import { dbGet, dbUpdate } from '../../../lib/db.js';
import { runMatchEngine } from '../../../lib/match.js';

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'medbridge2024';

export async function POST(request) {
  const authHeader = request.headers.get('x-clinic-auth');
  if (authHeader !== ADMIN_PASS) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { inventory_id, action } = await request.json();
    if (!inventory_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'inventory_id and action (approve|reject) required' }, { status: 400 });
    }

    const item = dbGet('inventory', inventory_id);
    if (!item || item.status !== 'pending') {
      return NextResponse.json({ error: 'Item not found or not in pending state' }, { status: 404 });
    }

    const now = new Date().toISOString();
    if (action === 'approve') {
      dbUpdate('inventory', inventory_id, { status: 'available', approved_at: now });
      runMatchEngine(inventory_id).catch(console.error);
      return NextResponse.json({ success: true, status: 'available' });
    } else {
      dbUpdate('inventory', inventory_id, { status: 'rejected', approved_at: now });
      return NextResponse.json({ success: true, status: 'rejected' });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
