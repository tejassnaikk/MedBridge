import { NextResponse } from 'next/server';
import { dbAll } from '../../../lib/db.js';
import { haversine, zipToCoords } from '../../../lib/distance.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get('zip');
  if (!zip) return NextResponse.json({ error: 'zip required' }, { status: 400 });

  const coords = await zipToCoords(zip.trim());
  if (!coords) return NextResponse.json({ error: 'Could not resolve zip code' }, { status: 400 });

  const clinics = dbAll('clinics', c => c.is_verified).map(c => ({
    ...c,
    distance_miles: parseFloat(haversine(c.lat, c.lng, coords.lat, coords.lng).toFixed(1)),
  }));

  clinics.sort((a, b) => a.distance_miles - b.distance_miles);
  return NextResponse.json({ clinics });
}
