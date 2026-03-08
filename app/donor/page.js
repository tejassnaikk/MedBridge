'use client';

import { useState } from 'react';

const GATES = [
  {
    id: 1,
    title: 'Medication Type',
    question: 'Is this medication a controlled substance, opioid, sleep aid, stimulant, benzodiazepine, or on the FDA REMS restricted list?',
    hint: 'Ineligible examples: Oxycodone, Adderall, Ambien, Xanax, Buprenorphine, Clozapine, Isotretinoin (Accutane)',
    yes_label: 'Yes — it is a controlled or REMS drug',
    no_label: 'No — it is a standard prescription medication',
    fail_on: true,
  },
  {
    id: 2,
    title: 'Expiry Date',
    question: 'Does the medication expire within the next 6 months?',
    hint: 'Check the expiry date on the bottle or blister pack. We require at least 6 months remaining.',
    yes_label: 'Yes — it expires within 6 months (or is expired)',
    no_label: 'No — it has more than 6 months until expiry',
    fail_on: true,
  },
  {
    id: 3,
    title: 'Packaging',
    question: 'Is the medication in its original, sealed manufacturer packaging?',
    hint: 'Opened bottles, partially used blister packs, repackaged, or compounded medications are not eligible.',
    yes_label: 'No — opened, repackaged, or compounded',
    no_label: 'Yes — sealed original packaging',
    fail_on: true,
  },
  {
    id: 4,
    title: 'Storage Conditions',
    question: 'Was the medication stored at room temperature, away from heat, moisture, and sunlight?',
    hint: 'Medications from bathrooms, cars, or that required refrigeration are not eligible.',
    yes_label: 'No — stored in bathroom, car, or required refrigeration',
    no_label: 'Yes — stored properly at room temperature',
    fail_on: true,
  },
  {
    id: 5,
    title: 'Privacy',
    question: 'Will you remove or redact the patient name from the medication label before drop-off?',
    hint: 'Use a permanent marker or remove the label. The clinic does not need to know who the medication came from.',
    yes_label: 'No — I cannot remove personal info',
    no_label: 'Yes — I will remove personal info from the label',
    fail_on: true,
  },
];

const DRUG_FORMS = ['tablet', 'capsule', 'inhaler', 'liquid', 'patch', 'cream', 'other'];

export default function DonorPage() {
  const [step, setStep] = useState('intro'); // intro | gates | details | zip | done | failed
  const [gate, setGate] = useState(0);
  const [failedGate, setFailedGate] = useState(null);

  const [drugForm, setDrugForm] = useState({
    drug_name: '', strength: '', form: 'tablet', quantity: '', expiry_date: '',
  });

  const [zip, setZip] = useState('');
  const [clinics, setClinics] = useState(null);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [donated, setDonated] = useState(false);

  const currentGate = GATES[gate];

  const handleAnswer = (answer) => {
    const g = GATES[gate];
    if (answer === g.fail_on) {
      setFailedGate(g);
      setStep('failed');
      return;
    }
    if (gate < GATES.length - 1) {
      setGate(gate + 1);
    } else {
      setStep('details');
    }
  };

  const findClinics = async () => {
    if (zip.length < 5) return;
    setLoadingClinics(true);
    try {
      const res = await fetch(`/api/nearest-clinic?zip=${zip}`);
      const data = await res.json();
      setClinics(data.clinics || []);
    } catch {
      setClinics([]);
    } finally {
      setLoadingClinics(false);
    }
  };

  const handleDonate = async (clinicId) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...drugForm, quantity: parseInt(drugForm.quantity), clinic_id: clinicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDonated(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('intro'); setGate(0); setFailedGate(null);
    setDrugForm({ drug_name: '', strength: '', form: 'tablet', quantity: '', expiry_date: '' });
    setZip(''); setClinics(null); setDonated(false); setSubmitError('');
  };

  // ── Intro ────────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-block font-mono text-[10px] tracking-[3px] text-[#10b981] border border-[#10b981]/40 px-3 py-1 rounded-sm mb-4 uppercase">
            Donate Medication
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Turn unused medications into<br />
            <span className="text-[#10b981]">someone's lifeline.</span>
          </h1>
          <p className="text-[#64748b] text-lg leading-relaxed max-w-lg mx-auto">
            Have sealed, unexpired medication? 5 quick questions check eligibility — then we collect
            the details and add it to our statewide inventory instantly.
          </p>
        </div>

        <div className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6 mb-6">
          <div className="font-mono text-[10px] tracking-[2px] text-[#10b981] uppercase mb-4">Eligible Donations</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              '✓ Non-controlled prescription medications',
              '✓ Sealed original manufacturer packaging',
              '✓ 6+ months until expiry',
              '✓ Stored at room temperature',
              '✓ Label with personal info removed',
              '✓ Statins, blood pressure, diabetes, thyroid, etc.',
            ].map(t => <div key={t} className="text-sm text-[#64748b]">{t}</div>)}
          </div>
        </div>

        <button
          onClick={() => setStep('gates')}
          className="w-full bg-[#10b981] text-[#0a0e1a] font-bold py-4 rounded-xl text-base hover:bg-[#059669] transition-all"
        >
          Check My Medication Eligibility →
        </button>
      </main>
    );
  }

  // ── Failure ──────────────────────────────────────────────────────────────
  if (step === 'failed') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-[#111827] border border-red-500/30 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🚫</div>
          <div className="font-mono text-[10px] tracking-[2px] text-red-400 uppercase mb-3">Gate {failedGate?.id} — Not Eligible</div>
          <h2 className="text-xl font-semibold text-white mb-4">This medication can't be donated</h2>
          <div className="bg-[#1a2235] border border-[#1e2d45] rounded-lg p-5 text-left mb-6">
            <div className="font-mono text-[10px] tracking-[2px] text-[#f59e0b] uppercase mb-3">Safe Disposal Options</div>
            <div className="flex flex-col gap-2">
              <a href="https://www.deadiversion.usdoj.gov/drug_disposal/takeback/" target="_blank" rel="noopener noreferrer"
                className="text-sm text-[#3b82f6] hover:text-[#60a5fa]">
                → DEA Drug Take-Back Locator
              </a>
              <a href="https://safe.pharmacy/drug-disposal/" target="_blank" rel="noopener noreferrer"
                className="text-sm text-[#3b82f6] hover:text-[#60a5fa]">
                → NABP Safe Pharmacy Disposal Locator
              </a>
            </div>
          </div>
          <button onClick={reset} className="text-sm text-[#64748b] hover:text-[#e2e8f0] underline">
            ← Check a different medication
          </button>
        </div>
      </main>
    );
  }

  // ── Gate questions ───────────────────────────────────────────────────────
  if (step === 'gates') {
    const progress = (gate / GATES.length) * 100;
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <div className="flex justify-between text-xs font-mono text-[#64748b] mb-2">
            <span>Gate {gate + 1} of {GATES.length}</span>
            <span>{currentGate.title}</span>
          </div>
          <div className="h-1.5 bg-[#1e2d45] rounded-full overflow-hidden">
            <div className="h-full bg-[#10b981] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1e2d45] rounded-xl p-8">
          <div className="font-mono text-[10px] tracking-[2px] text-[#10b981] uppercase mb-5">Eligibility Check · Gate {gate + 1}</div>
          <h2 className="text-xl font-semibold text-white mb-3 leading-relaxed">{currentGate.question}</h2>
          <p className="text-[#64748b] text-sm leading-relaxed mb-8">{currentGate.hint}</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleAnswer(true)}
              className="w-full text-left border border-[#1e2d45] hover:border-red-500/40 hover:bg-red-500/5 rounded-xl px-5 py-4 text-sm text-[#e2e8f0] transition-all"
            >
              <span className="text-red-400 font-mono mr-2">✗</span> {currentGate.yes_label}
            </button>
            <button
              onClick={() => handleAnswer(false)}
              className="w-full text-left border border-[#1e2d45] hover:border-[#10b981]/40 hover:bg-[#10b981]/5 rounded-xl px-5 py-4 text-sm text-[#e2e8f0] transition-all"
            >
              <span className="text-[#10b981] font-mono mr-2">✓</span> {currentGate.no_label}
            </button>
          </div>
        </div>

        {gate > 0 && (
          <button onClick={() => setGate(gate - 1)} className="mt-4 text-sm text-[#64748b] hover:text-[#e2e8f0] underline block">
            ← Back
          </button>
        )}
      </main>
    );
  }

  // ── Drug details form ────────────────────────────────────────────────────
  if (step === 'details') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">✅</div>
          <div className="font-mono text-[10px] tracking-[2px] text-[#10b981] uppercase mb-2">All 5 Gates Passed</div>
          <h2 className="text-xl font-bold text-white mb-2">Medication is eligible!</h2>
          <p className="text-[#64748b] text-sm">Enter the details from the label — we'll add it to the statewide inventory.</p>
        </div>

        <div className="bg-[#111827] border border-[#10b981]/30 rounded-xl p-6">
          <div className="font-mono text-[10px] tracking-[2px] text-[#10b981] uppercase mb-5">Medication Details</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Drug Name *</label>
              <input type="text" value={drugForm.drug_name}
                onChange={e => setDrugForm(f => ({ ...f, drug_name: e.target.value }))}
                placeholder="e.g. Metformin" className="w-full px-3 py-2.5 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Strength *</label>
              <input type="text" value={drugForm.strength}
                onChange={e => setDrugForm(f => ({ ...f, strength: e.target.value }))}
                placeholder="e.g. 500mg" className="w-full px-3 py-2.5 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Form</label>
              <select value={drugForm.form} onChange={e => setDrugForm(f => ({ ...f, form: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm">
                {DRUG_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Quantity (units) *</label>
              <input type="number" value={drugForm.quantity}
                onChange={e => setDrugForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="e.g. 30" min={1} className="w-full px-3 py-2.5 rounded-lg text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Expiry Date *</label>
              <input type="date" value={drugForm.expiry_date}
                onChange={e => setDrugForm(f => ({ ...f, expiry_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm" />
            </div>
          </div>
          <button
            onClick={() => {
              if (!drugForm.drug_name || !drugForm.strength || !drugForm.quantity || !drugForm.expiry_date) {
                alert('Please fill in all required fields');
                return;
              }
              setStep('zip');
            }}
            className="mt-5 w-full bg-[#10b981] text-[#0a0e1a] font-bold py-3 rounded-lg text-sm hover:bg-[#059669] transition-all"
          >
            Find Nearest Drop-Off Clinic →
          </button>
        </div>

        <button onClick={() => { setStep('gates'); setGate(GATES.length - 1); }}
          className="mt-4 text-sm text-[#64748b] hover:text-[#e2e8f0] underline block">
          ← Back
        </button>
      </main>
    );
  }

  // ── Zip + clinic finder + submit ─────────────────────────────────────────
  if (step === 'zip') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Find Your Drop-Off Clinic</h2>
          <p className="text-[#64748b] text-sm">
            Enter your zip. We'll show the nearest clinic and add{' '}
            <strong className="text-white">{drugForm.drug_name} {drugForm.strength}</strong>{' '}
            to their inventory the moment you confirm drop-off.
          </p>
        </div>

        <div className="bg-[#111827] border border-[#10b981]/30 rounded-xl p-6 mb-5">
          <div className="flex gap-3">
            <input type="text" value={zip} onChange={e => setZip(e.target.value)}
              placeholder="Enter your zip code" className="flex-1 px-3 py-2.5 rounded-lg text-sm"
              maxLength={10} onKeyDown={e => e.key === 'Enter' && findClinics()} />
            <button onClick={findClinics} disabled={loadingClinics || zip.length < 5}
              className="bg-[#10b981] text-[#0a0e1a] font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-[#059669] disabled:opacity-50 transition-all">
              {loadingClinics ? '...' : 'Find'}
            </button>
          </div>
        </div>

        {clinics !== null && clinics.length === 0 && (
          <div className="text-center text-[#64748b] text-sm py-6">No clinics found for that zip.</div>
        )}

        {clinics && clinics.length > 0 && (
          <div className="flex flex-col gap-4">
            {clinics.slice(0, 3).map((c, i) => {
              const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
              const todayHours = c.hours?.[today] || 'Closed';
              return (
                <div key={c.id} className={`bg-[#111827] border rounded-xl p-5 ${i === 0 ? 'border-[#10b981]/40' : 'border-[#1e2d45]'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        {i === 0 && <span className="font-mono text-[9px] bg-[#10b981]/20 text-[#10b981] px-2 py-0.5 rounded-full">NEAREST</span>}
                        <span className="font-semibold text-white">{c.name}</span>
                      </div>
                      <div className="text-[#64748b] text-sm">{c.address}, {c.city}, {c.state}</div>
                    </div>
                    <div className="text-[#10b981] font-mono text-sm font-bold">{c.distance_miles} mi</div>
                  </div>
                  <div className="text-xs text-[#64748b] mb-3">Today: {todayHours} · {c.contact_phone}</div>

                  {i === 0 && (
                    donated ? (
                      <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg px-4 py-3 text-sm text-[#10b981] text-center font-semibold">
                        ✓ Added to inventory — match engine is running
                      </div>
                    ) : (
                      <>
                        {submitError && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 mb-3">{submitError}</div>
                        )}
                        <button
                          onClick={() => handleDonate(c.id)}
                          disabled={submitting}
                          className="w-full bg-[#10b981] text-[#0a0e1a] font-bold py-3 rounded-lg text-sm hover:bg-[#059669] disabled:opacity-50 transition-all"
                        >
                          {submitting ? 'Adding to Inventory...' : `Confirm Drop-Off at ${c.name} →`}
                        </button>
                        <p className="text-[#64748b] text-xs mt-2 text-center">
                          Tap after you drop off the medication at this clinic.
                        </p>
                      </>
                    )
                  )}
                </div>
              );
            })}

            {donated && (
              <button onClick={reset} className="text-sm text-[#64748b] hover:text-[#e2e8f0] underline block text-center mt-2">
                ← Donate another medication
              </button>
            )}
          </div>
        )}

        {!donated && (
          <button onClick={() => setStep('details')} className="mt-4 text-sm text-[#64748b] hover:text-[#e2e8f0] underline block">
            ← Back
          </button>
        )}
      </main>
    );
  }
}
