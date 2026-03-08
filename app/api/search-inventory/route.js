import { NextResponse } from 'next/server';
import { dbAll } from '../../../lib/db.js';
import { haversine, zipToCoords } from '../../../lib/distance.js';
import { getTherapeuticAlternatives } from '../../../lib/drug-equivalents.js';

export async function POST(request) {
  try {
    const { drug_name, strength, zip_code } = await request.json();
    if (!drug_name || !zip_code) {
      return NextResponse.json({ error: 'drug_name and zip_code required' }, { status: 400 });
    }

    const patientCoords = await zipToCoords(zip_code.trim());
    const drugLower = drug_name.toLowerCase();
    const strengthLower = (strength || '').toLowerCase();

    const items = dbAll('inventory', item => {
      if (item.status !== 'available') return false;
      if (!item.drug_name.toLowerCase().includes(drugLower)) return false;
      if (strengthLower && item.strength.toLowerCase() !== strengthLower) return false;
      return true;
    });

    const clinics = dbAll('clinics', c => c.is_verified);
    const clinicMap = Object.fromEntries(clinics.map(c => [c.id, c]));

    const results = items.map(item => {
      const clinic = clinicMap[item.clinic_id];
      if (!clinic) return null;
      const dist = patientCoords
        ? parseFloat(haversine(clinic.lat, clinic.lng, patientCoords.lat, patientCoords.lng).toFixed(1))
        : null;
      return {
        ...item,
        clinic_name: clinic.name,
        address: clinic.address,
        city: clinic.city,
        state: clinic.state,
        hours: clinic.hours,
        contact_phone: clinic.contact_phone,
        distance_miles: dist,
        within_range: dist !== null ? dist <= 25 : true,
      };
    }).filter(Boolean);

    results.sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));

    let waitlist_position = null;
    let swap_suggestions = null;

    if (results.filter(r => r.within_range).length === 0) {
      const waiting = dbAll('waitlist', w =>
        w.status === 'waiting' && w.drug_name.toLowerCase().includes(drugLower)
      );
      waitlist_position = waiting.length + 1;

      // Find therapeutically similar drugs that ARE in stock nearby
      const alts = getTherapeuticAlternatives(drug_name);
      if (alts) {
        const altItems = dbAll('inventory', item => {
          if (item.status !== 'available') return false;
          return alts.alternatives.some(a => item.drug_name.toLowerCase().includes(a));
        });

        const altResults = altItems.map(item => {
          const clinic = clinicMap[item.clinic_id];
          if (!clinic) return null;
          const dist = patientCoords
            ? parseFloat(haversine(clinic.lat, clinic.lng, patientCoords.lat, patientCoords.lng).toFixed(1))
            : null;
          if (dist !== null && dist > 25) return null;
          return {
            ...item,
            clinic_name: clinic.name,
            address: clinic.address,
            city: clinic.city,
            state: clinic.state,
            hours: clinic.hours,
            contact_phone: clinic.contact_phone,
            distance_miles: dist,
          };
        }).filter(Boolean);

        altResults.sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));

        if (altResults.length > 0) {
          swap_suggestions = { drug_class: alts.className, items: altResults };
        }
      }
    }

    return NextResponse.json({ results, waitlist_position, swap_suggestions });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
