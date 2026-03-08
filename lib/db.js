/**
 * Simple JSON file database — no native modules, works everywhere.
 * All data stored in medbridge.json in the project root.
 */
import fs from 'fs';
import path from 'path';
import { COLORADO_FALLBACK } from './hrsa.js';

const DB_FILE = path.join(process.cwd(), 'medbridge.json');

// In-memory store (loaded once per process)
let _db = null;

export function getDb() {
  if (_db) return _db;
  try {
    _db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    _db = makeEmpty();
    seedData(_db);
    persist();
  }
  return _db;
}

export function persist() {
  if (_db) fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2));
}

function makeEmpty() {
  return {
    _seq: { clinics: 0, inventory: 0, waitlist: 0 },
    clinics: [],
    inventory: [],
    waitlist: [],
    hrsa_seeded: false,
  };
}

// ─── Simple query helpers ──────────────────────────────────────────────────

export function dbInsert(table, row) {
  const db = getDb();
  db._seq[table] = (db._seq[table] || 0) + 1;
  const id = db._seq[table];
  const newRow = { id, created_at: new Date().toISOString(), ...row };
  db[table].push(newRow);
  persist();
  return newRow;
}

export function dbUpdate(table, id, fields) {
  const db = getDb();
  const idx = db[table].findIndex(r => r.id === id);
  if (idx === -1) return null;
  Object.assign(db[table][idx], fields);
  persist();
  return db[table][idx];
}

export function dbGet(table, id) {
  return getDb()[table].find(r => r.id === id) || null;
}

export function dbAll(table, predicate) {
  const rows = getDb()[table];
  return predicate ? rows.filter(predicate) : [...rows];
}

// ─── Seed data ─────────────────────────────────────────────────────────────

function seedData(db) {
  const clinics = [
    {
      name: 'Open Bible Clinic',
      address: '2300 W Colfax Ave', city: 'Denver', state: 'CO', zip: '80204',
      lat: 39.7391, lng: -104.9953,
      hours: { Mon: '8am–5pm', Tue: '8am–5pm', Wed: '8am–5pm', Thu: '8am–5pm', Fri: '8am–5pm', Sat: 'Closed', Sun: 'Closed' },
      contact_phone: '303-555-0101', is_verified: true,
    },
    {
      name: 'Denver Health Community Pharmacy',
      address: '777 Bannock St', city: 'Denver', state: 'CO', zip: '80204',
      lat: 39.7280, lng: -104.9876,
      hours: { Mon: '7am–6pm', Tue: '7am–6pm', Wed: '7am–6pm', Thu: '7am–6pm', Fri: '7am–6pm', Sat: '9am–2pm', Sun: 'Closed' },
      contact_phone: '303-555-0102', is_verified: true,
    },
    {
      name: 'Salud Family Health Center',
      address: '9550 Grant St', city: 'Thornton', state: 'CO', zip: '80229',
      lat: 39.8986, lng: -104.9719,
      hours: { Mon: '8am–5pm', Tue: '8am–5pm', Wed: '8am–5pm', Thu: '8am–5pm', Fri: '8am–5pm', Sat: '9am–1pm', Sun: 'Closed' },
      contact_phone: '720-555-0103', is_verified: true,
    },
    {
      name: 'Colorado Coalition Free Clinic',
      address: '2130 Stout St', city: 'Denver', state: 'CO', zip: '80205',
      lat: 39.7476, lng: -104.9871,
      hours: { Mon: '9am–4pm', Tue: '9am–4pm', Wed: '9am–4pm', Thu: '9am–4pm', Fri: '9am–3pm', Sat: 'Closed', Sun: 'Closed' },
      contact_phone: '303-555-0104', is_verified: true,
    },
  ];

  clinics.forEach(c => {
    db._seq.clinics++;
    db.clinics.push({ id: db._seq.clinics, created_at: new Date().toISOString(), ...c });
  });

  const inventory = [
    { drug_name: 'Lisinopril', strength: '10mg', form: 'tablet', quantity: 30, expiry_date: '2026-12-01', clinic_id: 1, status: 'available' },
    { drug_name: 'Atorvastatin', strength: '20mg', form: 'tablet', quantity: 60, expiry_date: '2026-08-15', clinic_id: 1, status: 'available' },
    { drug_name: 'Metformin', strength: '500mg', form: 'tablet', quantity: 90, expiry_date: '2026-11-01', clinic_id: 2, status: 'available' },
    { drug_name: 'Amlodipine', strength: '5mg', form: 'tablet', quantity: 45, expiry_date: '2026-10-30', clinic_id: 2, status: 'available' },
    { drug_name: 'Levothyroxine', strength: '50mcg', form: 'tablet', quantity: 30, expiry_date: '2026-09-01', clinic_id: 3, status: 'available' },
    { drug_name: 'Omeprazole', strength: '20mg', form: 'capsule', quantity: 60, expiry_date: '2026-07-15', clinic_id: 3, status: 'available' },
    { drug_name: 'Metformin', strength: '1000mg', form: 'tablet', quantity: 45, expiry_date: '2026-10-01', clinic_id: 4, status: 'available' },
    { drug_name: 'Sertraline', strength: '50mg', form: 'tablet', quantity: 30, expiry_date: '2026-11-30', clinic_id: 4, status: 'available' },
  ];

  inventory.forEach(item => {
    db._seq.inventory++;
    db.inventory.push({ id: db._seq.inventory, created_at: new Date().toISOString(), date_received: new Date().toISOString(), ...item });
  });
}
