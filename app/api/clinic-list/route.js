import { NextResponse } from 'next/server';
import { dbAll } from '../../../lib/db.js';

// Public endpoint — returns all verified/active clinics for dropdowns
export async function GET() {
  const clinics = dbAll('clinics', c => c.is_verified && c.status !== 'rejected' && c.status !== 'pending');
  return NextResponse.json({ clinics });
}
