/**
 * Therapeutic drug equivalency database.
 * Maps drug names to their class and lists therapeutically similar alternatives.
 * Used to suggest in-stock alternatives when the searched drug is not available.
 */

// Each entry: canonical drug name (lowercase) -> { class, alternatives[] }
// alternatives are listed most-common first
const DRUG_CLASSES = [
  {
    name: 'Statin (Cholesterol)',
    members: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin', 'fluvastatin', 'pitavastatin'],
  },
  {
    name: 'ACE Inhibitor (Blood Pressure)',
    members: ['lisinopril', 'enalapril', 'ramipril', 'benazepril', 'captopril', 'fosinopril', 'quinapril', 'perindopril'],
  },
  {
    name: 'ARB (Blood Pressure)',
    members: ['losartan', 'valsartan', 'irbesartan', 'olmesartan', 'telmisartan', 'candesartan', 'azilsartan'],
  },
  {
    name: 'Calcium Channel Blocker (Blood Pressure)',
    members: ['amlodipine', 'nifedipine', 'diltiazem', 'verapamil', 'felodipine', 'nicardipine'],
  },
  {
    name: 'Beta Blocker (Heart/Blood Pressure)',
    members: ['metoprolol', 'atenolol', 'carvedilol', 'propranolol', 'bisoprolol', 'nebivolol', 'labetalol'],
  },
  {
    name: 'Thiazide Diuretic (Blood Pressure)',
    members: ['hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'metolazone'],
  },
  {
    name: 'Loop Diuretic',
    members: ['furosemide', 'bumetanide', 'torsemide', 'ethacrynic acid'],
  },
  {
    name: 'Biguanide (Diabetes)',
    members: ['metformin'],
  },
  {
    name: 'SSRI (Antidepressant)',
    members: ['sertraline', 'escitalopram', 'fluoxetine', 'paroxetine', 'citalopram', 'fluvoxamine'],
  },
  {
    name: 'SNRI (Antidepressant)',
    members: ['duloxetine', 'venlafaxine', 'desvenlafaxine', 'milnacipran'],
  },
  {
    name: 'Proton Pump Inhibitor (Acid Reflux)',
    members: ['omeprazole', 'pantoprazole', 'esomeprazole', 'lansoprazole', 'rabeprazole', 'dexlansoprazole'],
  },
  {
    name: 'Thyroid Hormone Replacement',
    members: ['levothyroxine', 'liothyronine'],
  },
  {
    name: 'Leukotriene Modifier (Asthma/Allergy)',
    members: ['montelukast', 'zafirlukast', 'zileuton'],
  },
  {
    name: 'Gabapentinoid (Neuropathic Pain)',
    members: ['gabapentin', 'pregabalin'],
  },
  {
    name: 'Short-Acting Bronchodilator (Asthma)',
    members: ['albuterol', 'levalbuterol'],
  },
  {
    name: 'Antihistamine (Allergy)',
    members: ['cetirizine', 'loratadine', 'fexofenadine', 'levocetirizine', 'desloratadine'],
  },
  {
    name: 'NSAID (Pain/Inflammation)',
    members: ['ibuprofen', 'naproxen', 'meloxicam', 'diclofenac', 'celecoxib', 'indomethacin'],
  },
  {
    name: 'Potassium-Sparing Diuretic',
    members: ['spironolactone', 'eplerenone', 'triamterene'],
  },
  {
    name: 'Alpha Blocker (BPH/Blood Pressure)',
    members: ['tamsulosin', 'doxazosin', 'terazosin', 'alfuzosin', 'silodosin'],
  },
  {
    name: 'Anticoagulant',
    members: ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran'],
  },
  {
    name: 'Antiplatelet',
    members: ['aspirin', 'clopidogrel', 'ticagrelor'],
  },
  {
    name: 'Sulfonylurea (Diabetes)',
    members: ['glipizide', 'glyburide', 'glimepiride'],
  },
];

/**
 * Given a drug name, returns the therapeutic class info or null.
 * @param {string} drugName
 * @returns {{ className: string, members: string[] } | null}
 */
export function getDrugClass(drugName) {
  const lower = drugName.toLowerCase().trim();
  for (const cls of DRUG_CLASSES) {
    if (cls.members.some(m => lower.includes(m) || m.includes(lower))) {
      return { className: cls.name, members: cls.members };
    }
  }
  return null;
}

/**
 * Given a searched drug name, returns canonical names of drugs in the same class
 * (excluding the searched drug itself).
 * @param {string} drugName
 * @returns {{ className: string, alternatives: string[] } | null}
 */
export function getTherapeuticAlternatives(drugName) {
  const cls = getDrugClass(drugName);
  if (!cls) return null;
  const lower = drugName.toLowerCase().trim();
  const alternatives = cls.members.filter(m => !lower.includes(m) && !m.includes(lower));
  return { className: cls.name, alternatives };
}
