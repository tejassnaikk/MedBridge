import { dbAll, dbUpdate, dbGet } from './db.js';
import { haversine, zipToCoords } from './distance.js';
import { decryptPhone } from './crypto.js';
import { sendSMS } from './sms.js';

// 300 miles covers all of Colorado statewide
const MATCH_RADIUS_MILES = 300;

export async function runMatchEngine(inventoryId) {
  expireStaleReservations();

  const item = dbGet('inventory', inventoryId);
  if (!item || item.status !== 'available') return { matched: false };

  const clinic = dbGet('clinics', item.clinic_id);
  if (!clinic) return { matched: false };

  const candidates = dbAll('waitlist', w =>
    w.status === 'waiting' &&
    w.drug_name.toLowerCase() === item.drug_name.toLowerCase() &&
    w.strength.toLowerCase() === item.strength.toLowerCase()
  ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  for (const patient of candidates) {
    const patientCoords = await zipToCoords(patient.zip_code);
    if (!patientCoords) continue;

    const dist = haversine(clinic.lat, clinic.lng, patientCoords.lat, patientCoords.lng);
    if (dist > MATCH_RADIUS_MILES) continue;

    dbUpdate('inventory', item.id, { status: 'reserved' });
    dbUpdate('waitlist', patient.id, {
      status: 'notified',
      notified_at: new Date().toISOString(),
      reserved_inventory_id: item.id,
    });

    const phone = decryptPhone(patient.phone_encrypted);
    const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
    const todayHours = clinic.hours?.[today] || 'Call to confirm hours';
    const claimUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/claim/${patient.id}`;

    await sendSMS(phone,
      `MedBridge: ${item.drug_name} ${item.strength} is available at ${clinic.name}, ` +
      `${clinic.address}, ${clinic.city} — ${dist.toFixed(1)} miles away. ` +
      `Today: ${todayHours}. Bring Rx + ID. FREE. 48-hour window. ` +
      `Confirm pickup: ${claimUrl} — Reply STOP to opt out.`
    );

    return { matched: true, clinic: clinic.name, distance: dist.toFixed(1) };
  }

  return { matched: false };
}

export function expireStaleReservations() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const stale = dbAll('waitlist', w =>
    w.status === 'notified' && w.notified_at && w.notified_at < cutoff
  );

  for (const entry of stale) {
    dbUpdate('waitlist', entry.id, { status: 'expired' });
    if (entry.reserved_inventory_id) {
      dbUpdate('inventory', entry.reserved_inventory_id, { status: 'available' });
      runMatchEngine(entry.reserved_inventory_id).catch(() => {});
    }
  }
}
