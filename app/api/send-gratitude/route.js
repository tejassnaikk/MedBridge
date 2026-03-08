import { NextResponse } from 'next/server';
import { dbGet } from '../../../lib/db.js';
import { sendGratitudeEmail } from '../../../lib/email.js';

export async function POST(request) {
  try {
    const { inventory_id, message } = await request.json();

    if (!inventory_id || !message?.trim()) {
      return NextResponse.json({ error: 'inventory_id and message required' }, { status: 400 });
    }

    const trimmed = message.trim().slice(0, 200);

    const item = dbGet('inventory', parseInt(inventory_id));
    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    if (!item.donor_email) {
      // Donor did not provide an email — silently succeed (no-op)
      return NextResponse.json({ success: true, delivered: false });
    }

    await sendGratitudeEmail(item.donor_email, {
      drugName: item.drug_name,
      strength: item.strength,
      message: trimmed,
    });

    return NextResponse.json({ success: true, delivered: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
