import { NextResponse } from 'next/server';
import { dbUpdate, dbGet, dbAll } from '../../../lib/db.js';

const ADMIN_PASSWORD = process.env.CLINIC_PASSWORD || 'medbridge2024';

function checkAuth(request) {
  return request.headers.get('x-clinic-auth') === ADMIN_PASSWORD;
}

// POST /api/approve-clinic  { clinic_id, action: 'approve' | 'reject' }
export async function POST(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clinic_id, action } = await request.json();
    if (!clinic_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'clinic_id and action (approve|reject) required' }, { status: 400 });
    }

    const clinic = dbGet('clinics', parseInt(clinic_id));
    if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });

    if (action === 'approve') {
      dbUpdate('clinics', clinic.id, { is_verified: true, status: 'active' });
      return NextResponse.json({ success: true, message: `${clinic.name} approved and now active.` });
    } else {
      dbUpdate('clinics', clinic.id, { status: 'rejected' });
      return NextResponse.json({ success: true, message: `${clinic.name} rejected.` });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/approve-clinic — list pending (admin only)
export async function GET(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const pending = dbAll('clinics', c => c.status === 'pending');
  const active = dbAll('clinics', c => c.is_verified && c.status !== 'rejected');
  return NextResponse.json({ pending, active });
}
