import { NextResponse } from 'next/server';
import { dbAll, dbInsert, getDb, persist } from '../../../lib/db.js';
import { fetchColoradoClinics } from '../../../lib/hrsa.js';

const ADMIN_PASSWORD = process.env.CLINIC_PASSWORD || 'medbridge2024';

// POST /api/hrsa-sync — pull latest clinics from HRSA federal API (admin only)
export async function POST(request) {
  const auth = request.headers.get('x-clinic-auth');
  if (auth !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hrsaClinics = await fetchColoradoClinics();
    const existing = dbAll('clinics');

    let added = 0;
    let skipped = 0;

    for (const clinic of hrsaClinics) {
      // Match by hrsa_id (if available) or name+zip
      const duplicate = existing.find(e =>
        (clinic.hrsa_id && e.hrsa_id === clinic.hrsa_id) ||
        (e.name.toLowerCase() === clinic.name.toLowerCase() && e.zip === clinic.zip)
      );

      if (duplicate) {
        skipped++;
        continue;
      }

      dbInsert('clinics', { ...clinic, status: 'active' });
      added++;
    }

    // Mark DB as HRSA-seeded
    const db = getDb();
    db.hrsa_last_sync = new Date().toISOString();
    persist();

    return NextResponse.json({
      success: true,
      added,
      skipped,
      total_source: hrsaClinics.length,
      message: `Sync complete: ${added} new clinics added, ${skipped} already existed.`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/hrsa-sync — check sync status
export async function GET(request) {
  const auth = request.headers.get('x-clinic-auth');
  if (auth !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getDb();
  return NextResponse.json({
    hrsa_last_sync: db.hrsa_last_sync || null,
    total_clinics: dbAll('clinics').length,
    verified_clinics: dbAll('clinics', c => c.is_verified).length,
    pending_clinics: dbAll('clinics', c => c.status === 'pending').length,
  });
}
