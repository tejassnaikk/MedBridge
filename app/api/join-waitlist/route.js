import { NextResponse } from 'next/server';
import { dbInsert, dbAll } from '../../../lib/db.js';
import { encryptPhone } from '../../../lib/crypto.js';

export async function POST(request) {
  try {
    const { drug_name, strength, zip_code, phone, has_rx } = await request.json();

    if (!drug_name || !zip_code || !phone) {
      return NextResponse.json({ error: 'drug_name, zip_code, and phone are required' }, { status: 400 });
    }
    if (!has_rx) {
      return NextResponse.json({ error: 'A valid prescription is required to join the waitlist' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit phone number' }, { status: 400 });
    }
    const e164Phone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;
    const phone_encrypted = encryptPhone(e164Phone);

    const entry = dbInsert('waitlist', {
      drug_name: drug_name.trim(),
      strength: (strength || '').trim(),
      zip_code: zip_code.trim(),
      phone_encrypted,
      has_rx: true,
      status: 'waiting',
      notified_at: null,
      reserved_inventory_id: null,
    });

    const drugLower = drug_name.toLowerCase();
    const available = dbAll('inventory', i =>
      i.status === 'available' && i.drug_name.toLowerCase().includes(drugLower)
    );

    if (available.length > 0) {
      const { runMatchEngine } = await import('../../../lib/match.js');
      runMatchEngine(available[0].id).catch(console.error);
    }

    const position = dbAll('waitlist', w =>
      w.status === 'waiting' && w.drug_name.toLowerCase().includes(drugLower) && w.id <= entry.id
    ).length;

    return NextResponse.json({ success: true, waitlist_id: entry.id, position });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
