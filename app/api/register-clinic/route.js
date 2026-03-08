import { NextResponse } from 'next/server';
import { dbInsert, dbAll } from '../../../lib/db.js';
import { geocodeAddress } from '../../../lib/hrsa.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, address, city, zip, contact_phone, contact_email, hours, notes } = body;

    if (!name || !address || !city || !zip) {
      return NextResponse.json({ error: 'Name, address, city, and zip are required.' }, { status: 400 });
    }

    // Deduplicate: check if a clinic with the same name+zip already exists
    const existing = dbAll('clinics', c =>
      c.name.toLowerCase() === name.toLowerCase() && c.zip === zip.trim()
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A clinic with this name and zip code is already registered.' }, { status: 409 });
    }

    // Geocode the address via Nominatim
    const coords = await geocodeAddress(address, city, 'CO', zip);

    const clinic = dbInsert('clinics', {
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: 'CO',
      zip: zip.trim(),
      lat: coords?.lat || null,
      lng: coords?.lng || null,
      hours: hours || null,
      contact_phone: contact_phone?.trim() || null,
      contact_email: contact_email?.trim() || null,
      notes: notes?.trim() || null,
      is_verified: false,
      status: 'pending',
      source: 'self_registered',
    });

    return NextResponse.json({
      success: true,
      clinic_id: clinic.id,
      geocoded: !!coords,
      message: coords
        ? 'Registration submitted! Your clinic is pending review.'
        : 'Registration submitted (address could not be geocoded — an admin will verify location).',
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  // List all pending clinics (for admin review)
  const pending = dbAll('clinics', c => c.status === 'pending');
  return NextResponse.json({ pending });
}
