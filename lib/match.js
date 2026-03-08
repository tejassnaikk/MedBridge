import { dbAll, dbUpdate, dbGet } from './db.js';
import { haversine, zipToCoords } from './distance.js';
import { decryptPhone } from './crypto.js';
import { sendSMS } from './sms.js';
import { sendNotificationEmail } from './email.js';

// 300 miles covers all of Colorado statewide
const MATCH_RADIUS_MILES = 300;

// Normalise strength: lowercase, collapse spaces around units, strip trailing dots
// e.g. "500 MG" → "500mg", "10 mcg" → "10mcg", "2.5mg." → "2.5mg"
function normalizeStrength(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s*(mg|mcg|ml|g|iu|units?|%)\s*/g, '$1')
    .replace(/\.$/, '')
    .trim();
}

// Levenshtein edit distance (for fuzzy drug name matching)
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// Drug name match: substring in either direction OR edit distance ≤ 2 (catches typos)
function drugNamesMatch(a, b) {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y || x.includes(y) || y.includes(x)) return true;
  // Allow up to 2 character edits so "Metprolol" still matches "Metoprolol"
  return editDistance(x, y) <= 2;
}

export async function runMatchEngine(inventoryId) {
  expireStaleReservations();

  const item = dbGet('inventory', inventoryId);
  if (!item || item.status !== 'available') return { matched: false };

  const clinic = dbGet('clinics', item.clinic_id);
  if (!clinic) return { matched: false };

  const normItemStrength = normalizeStrength(item.strength);

  const candidates = dbAll('waitlist', w =>
    w.status === 'waiting' &&
    drugNamesMatch(w.drug_name, item.drug_name) &&
    normalizeStrength(w.strength) === normItemStrength
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

    const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
    const todayHours = clinic.hours?.[today] || 'Call to confirm hours';
    const claimUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/claim/${patient.id}`;
    const notifPayload = {
      drugName: item.drug_name,
      strength: item.strength,
      clinicName: clinic.name,
      clinicAddress: `${clinic.address}, ${clinic.city}`,
      distanceMiles: dist.toFixed(1),
      todayHours,
      claimUrl,
    };

    // Email is primary; SMS is fallback if phone is also stored
    if (patient.email) {
      await sendNotificationEmail(patient.email, notifPayload);
    }
    if (patient.phone_encrypted) {
      const phone = decryptPhone(patient.phone_encrypted);
      await sendSMS(phone,
        `MedBridge: ${item.drug_name} ${item.strength} is available at ${clinic.name}, ` +
        `${clinic.address}, ${clinic.city} — ${dist.toFixed(1)} miles away. ` +
        `Today: ${todayHours}. Bring Rx + ID. FREE. 48-hour window. ` +
        `Confirm pickup: ${claimUrl} — Reply STOP to opt out.`
      );
    }

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
