'use client';

import { useState } from 'react';

const COMMON_DRUGS = [
  'Metformin', 'Lisinopril', 'Atorvastatin', 'Amlodipine', 'Levothyroxine',
  'Omeprazole', 'Sertraline', 'Metoprolol', 'Losartan', 'Gabapentin',
  'Hydrochlorothiazide', 'Furosemide', 'Pantoprazole', 'Montelukast',
  'Simvastatin', 'Escitalopram', 'Albuterol', 'Duloxetine', 'Fluoxetine',
];

// Convert a File to base64 string
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PatientPage() {
  const [form, setForm] = useState({ drug_name: '', strength: '', zip_code: '' });
  const [results, setResults] = useState(null);
  const [swapSuggestions, setSwapSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [waitlistForm, setWaitlistForm] = useState({ email: '', quantity_requested: 30 });
  const PATIENT_QTY_MIN = 7;
  const PATIENT_QTY_MAX = 90;
  const [waitlistState, setWaitlistState] = useState('idle'); // idle | submitting | done | failed
  const [waitlistResult, setWaitlistResult] = useState(null);
  const [waitlistVerifyResult, setWaitlistVerifyResult] = useState(null);
  const [waitlistRxFile, setWaitlistRxFile] = useState(null);
  const [waitlistIdFile, setWaitlistIdFile] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  // In-stock card: verify & reserve state
  const [selectedItem, setSelectedItem] = useState(null); // item the patient clicked
  const [verifyForm, setVerifyForm] = useState({ email: '', quantity: PATIENT_QTY_MIN });
  const [rxFile, setRxFile] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [verifyState, setVerifyState] = useState('idle'); // idle | loading | done | failed
  const [verifyResult, setVerifyResult] = useState(null);

  const handleDrugInput = (val) => {
    setForm(f => ({ ...f, drug_name: val }));
    if (val.length >= 2) {
      setSuggestions(COMMON_DRUGS.filter(d => d.toLowerCase().startsWith(val.toLowerCase())).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);
    setSwapSuggestions(null);
    setWaitlistState('idle');
    setSuggestions([]);
    try {
      const res = await fetch('/api/search-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setSwapSuggestions(data.swap_suggestions || null);
      setResults(data);
    } catch {
      setResults({ error: 'Failed to search. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async (e) => {
    e.preventDefault();
    if (!waitlistRxFile || !waitlistIdFile) { alert('Please upload both your prescription and state ID.'); return; }
    setWaitlistState('submitting');
    setWaitlistVerifyResult(null);
    try {
      const [rxBase64, idBase64] = await Promise.all([fileToBase64(waitlistRxFile), fileToBase64(waitlistIdFile)]);
      const res = await fetch('/api/join-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, ...waitlistForm,
          rx_image: rxBase64,
          rx_mime: waitlistRxFile.type || 'image/jpeg',
          id_image: idBase64,
          id_mime: waitlistIdFile.type || 'image/jpeg',
        }),
      });
      const data = await res.json();
      if (data.verified === false) {
        setWaitlistVerifyResult(data);
        setWaitlistState('failed');
      } else if (!res.ok) {
        throw new Error(data.error);
      } else {
        setWaitlistResult(data);
        setWaitlistState('done');
      }
    } catch (err) {
      alert(err.message);
      setWaitlistState('idle');
    }
  };

  const handleVerifyAndReserve = async (e) => {
    e.preventDefault();
    if (!rxFile || !idFile) { alert('Please upload both your prescription and state ID.'); return; }
    setVerifyState('loading');
    try {
      const [rxBase64, idBase64] = await Promise.all([fileToBase64(rxFile), fileToBase64(idFile)]);
      const res = await fetch('/api/verify-and-reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_id: selectedItem.id,
          email: verifyForm.email,
          quantity_requested: verifyForm.quantity,
          rx_image: rxBase64,
          rx_mime: rxFile.type || 'image/jpeg',
          id_image: idBase64,
          id_mime: idFile.type || 'image/jpeg',
        }),
      });
      const data = await res.json();
      setVerifyResult(data);
      setVerifyState(data.verified ? 'done' : 'failed');
    } catch (err) {
      setVerifyResult({ verified: false, reason: err.message });
      setVerifyState('failed');
    }
  };

  const nearby = results?.results?.filter(r => r.within_range) || [];
  const hasResults = results && !results.error;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-block font-mono text-[10px] tracking-[3px] text-[#00d4aa] border border-[#00d4aa]/40 px-3 py-1 rounded-sm mb-4 uppercase">
          Free Medications · Colorado Pilot
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">
          Can't afford your<br />
          <span className="text-[#00d4aa]">medication?</span>
        </h1>
        <p className="text-[#64748b] text-lg max-w-xl mx-auto leading-relaxed">
          Search for donated medications at free clinics near you.
          Valid prescription required. 100% free of charge.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6 mb-8 relative">
        <div className="font-mono text-[10px] tracking-[2px] text-[#00d4aa] uppercase mb-5">Search Available Medications</div>

        <div className="grid sm:grid-cols-3 gap-3">
          {/* Drug name with autocomplete */}
          <div className="sm:col-span-1 relative">
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Medication Name</label>
            <input
              type="text"
              value={form.drug_name}
              onChange={e => handleDrugInput(e.target.value)}
              placeholder="e.g. Metformin"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              required
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-[#1a2235] border border-[#1e2d45] rounded-lg overflow-hidden shadow-xl">
                {suggestions.map(s => (
                  <li
                    key={s}
                    onClick={() => { setForm(f => ({ ...f, drug_name: s })); setSuggestions([]); }}
                    className="px-3 py-2 text-sm text-[#e2e8f0] hover:bg-[#00d4aa]/10 hover:text-[#00d4aa] cursor-pointer"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Strength</label>
            <input
              type="text"
              value={form.strength}
              onChange={e => setForm(f => ({ ...f, strength: e.target.value }))}
              placeholder="e.g. 500mg"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Your Zip Code</label>
            <input
              type="text"
              value={form.zip_code}
              onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))}
              placeholder="e.g. 80204"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              required
              maxLength={10}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full bg-[#00d4aa] text-[#0a0e1a] font-bold py-3 rounded-lg text-sm hover:bg-[#00bfa0] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Searching...' : 'Search for Medication'}
        </button>
      </form>

      {/* Results */}
      {results?.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {results.error}
        </div>
      )}

      {hasResults && (
        <div>
          {nearby.length > 0 ? (
            <div>
              <div className="font-mono text-[10px] tracking-[2px] text-[#10b981] uppercase mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
                {nearby.length} location{nearby.length !== 1 ? 's' : ''} available near you
              </div>

              <div className="flex flex-col gap-3">
                {nearby.map(item => {
                  const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
                  const todayHours = item.hours?.[today] || 'Call to confirm hours';
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <div key={item.id} className={`bg-[#111827] border rounded-xl overflow-hidden transition-all ${isSelected ? 'border-[#00d4aa]' : 'border-[#10b981]/30 cursor-pointer hover:border-[#10b981]'}`}>
                      {/* Card header — always visible, clickable to expand */}
                      <div
                        className="p-5"
                        onClick={() => {
                          if (!isSelected) {
                            setSelectedItem(item);
                            setVerifyState('idle');
                            setVerifyResult(null);
                            setVerifyForm({ email: '', quantity: Math.min(PATIENT_QTY_MAX, Math.max(PATIENT_QTY_MIN, item.quantity)) });
                            setRxFile(null);
                            setIdFile(null);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-white">{item.clinic_name}</div>
                            <div className="text-[#64748b] text-sm mt-0.5">{item.address}, {item.city}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[#10b981] font-mono text-sm font-bold">{item.distance_miles} mi</div>
                            <div className="text-[#64748b] text-xs">away</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs mb-3">
                          <span className="bg-[#10b981]/10 text-[#10b981] px-2 py-1 rounded-md">{item.drug_name} {item.strength}</span>
                          <span className="bg-[#1a2235] text-[#64748b] px-2 py-1 rounded-md">{item.quantity} units · {item.form}</span>
                          <span className="bg-[#1a2235] text-[#64748b] px-2 py-1 rounded-md">Today: {todayHours}</span>
                          {item.contact_phone && <span className="bg-[#1a2235] text-[#64748b] px-2 py-1 rounded-md">{item.contact_phone}</span>}
                        </div>
                        {!isSelected && (
                          <div className="flex items-center justify-between bg-[#00d4aa]/10 border border-[#00d4aa]/20 rounded-lg px-4 py-3 text-sm text-[#e2e8f0]">
                            <span>Available now — click to verify &amp; reserve</span>
                            <span className="text-[#00d4aa] font-bold text-base">›</span>
                          </div>
                        )}
                      </div>

                      {/* Inline verify & reserve panel */}
                      {isSelected && (
                        <div className="border-t border-[#00d4aa]/30 bg-[#0d1424] px-5 pb-6 pt-5">
                          {verifyState === 'done' ? (
                            <div className="text-center py-2">
                              <div className="text-3xl mb-3">✓</div>
                              <div className="text-[#10b981] font-bold text-lg mb-1">Reservation confirmed!</div>
                              <div className="text-white text-sm mb-1">
                                <strong>{verifyResult.qty_reserved} units</strong> of {verifyResult.drug_name} {verifyResult.strength} reserved for you.
                              </div>
                              <div className="text-[#64748b] text-sm mb-3">
                                {verifyResult.clinic_name} · {verifyResult.today_hours}
                              </div>
                              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-lg px-4 py-3 text-sm text-[#f59e0b] text-left">
                                Bring your <strong>prescription</strong> + <strong>photo ID</strong> in person within 48 hours. Reservation ID: <strong className="font-mono">#{verifyResult.reservation_id}</strong>
                              </div>
                              {verifyResult.stub && (
                                <p className="text-xs text-[#475569] mt-2">⚠ Document verification ran in demo mode (no API key set)</p>
                              )}
                            </div>
                          ) : verifyState === 'failed' ? (
                            <div>
                              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-full border ${
                                    verifyResult?.failed_doc === 'rx'
                                      ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30'
                                      : verifyResult?.failed_doc === 'id'
                                      ? 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/30'
                                      : 'text-red-400 bg-red-500/10 border-red-500/20'
                                  }`}>
                                    {verifyResult?.failed_doc === 'rx' ? '💊 PRESCRIPTION' : verifyResult?.failed_doc === 'id' ? '🪪 STATE ID' : 'VERIFICATION'}
                                  </span>
                                  <span className="text-xs text-red-400 font-semibold">Failed</span>
                                </div>
                                <p className="text-sm text-red-300">{verifyResult?.reason}</p>
                                <p className="text-xs text-[#64748b] mt-2">
                                  {verifyResult?.failed_doc === 'rx'
                                    ? 'Re-upload the correct prescription using the 💊 field below.'
                                    : verifyResult?.failed_doc === 'id'
                                    ? "Re-upload your driver's license or state ID using the 🪪 field below."
                                    : 'Please check both documents and try again.'}
                                </p>
                              </div>
                              <button onClick={() => { setVerifyState('idle'); setVerifyResult(null); }}
                                className="text-xs text-[#00d4aa] hover:underline">← Try again with corrected documents</button>
                            </div>
                          ) : (
                            <form onSubmit={handleVerifyAndReserve} className="space-y-4">
                              <div className="font-mono text-[10px] tracking-[2px] text-[#00d4aa] uppercase mb-1">Verify your documents to reserve</div>
                              <p className="text-[#64748b] text-xs">Upload a photo of your prescription and Colorado state ID. Our AI verifies them instantly — documents are not stored.</p>

                              <div>
                                <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Email Address</label>
                                <input
                                  type="email"
                                  value={verifyForm.email}
                                  onChange={e => setVerifyForm(f => ({ ...f, email: e.target.value }))}
                                  placeholder="you@example.com"
                                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#1a2235] border border-[#1e2d45] text-white placeholder-[#64748b] focus:outline-none focus:border-[#00d4aa]"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Quantity Needed</label>
                                <input
                                  type="number"
                                  min={PATIENT_QTY_MIN}
                                  max={Math.min(PATIENT_QTY_MAX, item.quantity)}
                                  value={verifyForm.quantity}
                                  onChange={e => setVerifyForm(f => ({ ...f, quantity: parseInt(e.target.value) || PATIENT_QTY_MIN }))}
                                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#1a2235] border border-[#1e2d45] text-white focus:outline-none focus:border-[#00d4aa]"
                                  required
                                />
                                <p className="text-[#64748b] text-xs mt-1">Min {PATIENT_QTY_MIN} · Max {Math.min(PATIENT_QTY_MAX, item.quantity)} units available</p>
                              </div>

                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Prescription Photo</label>
                                  <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg px-3 py-4 cursor-pointer transition-colors ${rxFile ? 'border-[#10b981] bg-[#10b981]/5' : 'border-[#1e2d45] hover:border-[#00d4aa]/50'}`}>
                                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setRxFile(e.target.files[0])} required />
                                    {rxFile ? (
                                      <><div className="text-[#10b981] text-lg mb-1">✓</div><div className="text-xs text-[#10b981] text-center truncate max-w-full">{rxFile.name}</div></>
                                    ) : (
                                      <><div className="text-2xl mb-1">💊</div><div className="text-xs text-[#64748b] text-center">Tap to upload Rx</div></>
                                    )}
                                  </label>
                                </div>
                                <div>
                                  <label className="block text-xs text-[#64748b] mb-1.5 font-mono">State ID / Driver's License</label>
                                  <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg px-3 py-4 cursor-pointer transition-colors ${idFile ? 'border-[#10b981] bg-[#10b981]/5' : 'border-[#1e2d45] hover:border-[#00d4aa]/50'}`}>
                                    <input type="file" accept="image/*" className="hidden" onChange={e => setIdFile(e.target.files[0])} required />
                                    {idFile ? (
                                      <><div className="text-[#10b981] text-lg mb-1">✓</div><div className="text-xs text-[#10b981] text-center truncate max-w-full">{idFile.name}</div></>
                                    ) : (
                                      <><div className="text-2xl mb-1">🪪</div><div className="text-xs text-[#64748b] text-center">Tap to upload ID</div></>
                                    )}
                                  </label>
                                </div>
                              </div>

                              <div className="flex gap-3">
                                <button type="submit" disabled={verifyState === 'loading'}
                                  className="flex-1 bg-[#00d4aa] text-[#0a0e1a] font-bold py-3 rounded-lg text-sm hover:bg-[#00bfa0] disabled:opacity-50 transition-all">
                                  {verifyState === 'loading' ? 'Verifying with AI…' : 'Verify & Reserve →'}
                                </button>
                                <button type="button" onClick={() => { setSelectedItem(null); setVerifyState('idle'); }}
                                  className="px-4 py-3 rounded-lg text-sm text-[#64748b] border border-[#1e2d45] hover:text-white transition-all">
                                  Cancel
                                </button>
                              </div>
                              <p className="text-[#475569] text-xs">Your documents are analyzed by AI and never stored on our servers.</p>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Not in stock — show waitlist */
            <div>
              <div className="font-mono text-[10px] tracking-[2px] text-[#f59e0b] uppercase mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                Not in stock nearby — join the waitlist
              </div>

              {/* Smart Swap Suggestions */}
              {swapSuggestions && (
                <div className="bg-[#111827] border border-[#f59e0b]/30 rounded-xl p-5 mb-6">
                  <div className="font-mono text-[10px] tracking-[2px] text-[#f59e0b] uppercase mb-1">Smart Swap — Therapeutically Similar</div>
                  <p className="text-[#64748b] text-xs mb-4 leading-relaxed">
                    <strong className="text-white">{form.drug_name}</strong> isn't available nearby, but these drugs from the same class (<span className="text-[#f59e0b]">{swapSuggestions.drug_class}</span>) are in stock. Ask your doctor if a swap is right for you.
                  </p>
                  <div className="flex flex-col gap-3">
                    {swapSuggestions.items.slice(0, 3).map(item => {
                      const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
                      const todayHours = item.hours?.[today] || 'Call to confirm';
                      return (
                        <div key={item.id} className="bg-[#0d1424] border border-[#1e2d45] rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-white font-semibold text-sm">{item.drug_name} {item.strength}</span>
                              <div className="text-[#64748b] text-xs mt-0.5">{item.clinic_name} · {item.city}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[#f59e0b] font-mono text-sm font-bold">{item.distance_miles} mi</div>
                              <div className="text-[#64748b] text-xs">{item.quantity} units</div>
                            </div>
                          </div>
                          <div className="text-[#64748b] text-xs">Today: {todayHours}{item.contact_phone ? ` · ${item.contact_phone}` : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[#475569] text-xs mt-3">These are suggestions only. Always consult your prescriber before switching medications.</p>
                </div>
              )}

              {waitlistState === 'done' ? (
                <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl p-6 text-center">
                  <div className="text-3xl mb-3">✓</div>
                  <div className="text-white font-semibold text-lg mb-2">You're on the waitlist!</div>
                  <div className="text-[#64748b] text-sm leading-relaxed">
                    You are <strong className="text-white">#{waitlistResult?.position}</strong> in line for {form.drug_name} {form.strength}.
                    We'll email you the moment it becomes available within 25 miles.
                  </div>
                </div>
              ) : (
                <div className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6">
                  <div className="text-white font-semibold mb-1">Join the waitlist</div>
                  <div className="text-[#64748b] text-sm mb-5">We'll notify you when {form.drug_name}{form.strength ? ` ${form.strength}` : ''} becomes available near you. Upload your documents to verify eligibility.</div>

                  {waitlistState === 'failed' && waitlistVerifyResult && (
                    <div className="mb-4">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-full border ${
                            waitlistVerifyResult.failed_doc === 'rx'
                              ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30'
                              : waitlistVerifyResult.failed_doc === 'id'
                              ? 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/30'
                              : 'text-red-400 bg-red-500/10 border-red-500/20'
                          }`}>
                            {waitlistVerifyResult.failed_doc === 'rx' ? '💊 PRESCRIPTION' : waitlistVerifyResult.failed_doc === 'id' ? '🪪 STATE ID' : 'VERIFICATION'}
                          </span>
                          <span className="text-xs text-red-400 font-semibold">Failed</span>
                        </div>
                        <p className="text-sm text-red-300">{waitlistVerifyResult.reason}</p>
                        <p className="text-xs text-[#64748b] mt-2">
                          {waitlistVerifyResult.failed_doc === 'rx'
                            ? 'Re-upload the correct prescription using the 💊 field below.'
                            : waitlistVerifyResult.failed_doc === 'id'
                            ? "Re-upload your driver's license or state ID using the 🪪 field below."
                            : 'Please check both documents and try again.'}
                        </p>
                      </div>
                      <button onClick={() => { setWaitlistState('idle'); setWaitlistVerifyResult(null); }}
                        className="text-xs text-[#00d4aa] hover:underline">← Try again with corrected documents</button>
                    </div>
                  )}

                  <form onSubmit={handleJoinWaitlist} className="space-y-4">
                    <div>
                      <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Email Address</label>
                      <input
                        type="email"
                        value={waitlistForm.email}
                        onChange={e => setWaitlistForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2.5 rounded-lg text-sm"
                        required
                      />
                      <p className="text-[#64748b] text-xs mt-1">Used only to notify you when your medication is available. One email, no spam.</p>
                    </div>

                    <div>
                      <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Quantity Needed <span className="text-[#475569]">(number of pills / units)</span></label>
                      <input
                        type="number"
                        min={PATIENT_QTY_MIN}
                        max={PATIENT_QTY_MAX}
                        value={waitlistForm.quantity_requested}
                        onChange={e => setWaitlistForm(f => ({ ...f, quantity_requested: parseInt(e.target.value) || PATIENT_QTY_MIN }))}
                        className="w-full px-3 py-2.5 rounded-lg text-sm"
                        required
                      />
                      <p className="text-[#64748b] text-xs mt-1">Min {PATIENT_QTY_MIN} · Max {PATIENT_QTY_MAX} units (up to 3-month supply)</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Prescription Photo</label>
                        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg px-3 py-4 cursor-pointer transition-colors ${waitlistRxFile ? 'border-[#10b981] bg-[#10b981]/5' : waitlistVerifyResult?.failed_doc === 'rx' ? 'border-red-500/50' : 'border-[#1e2d45] hover:border-[#3b82f6]/50'}`}>
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setWaitlistRxFile(e.target.files[0])} required />
                          {waitlistRxFile ? (
                            <><div className="text-[#10b981] text-lg mb-1">✓</div><div className="text-xs text-[#10b981] text-center truncate max-w-full">{waitlistRxFile.name}</div></>
                          ) : (
                            <><div className="text-2xl mb-1">💊</div><div className="text-xs text-[#64748b] text-center">Tap to upload Rx</div></>
                          )}
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs text-[#64748b] mb-1.5 font-mono">State ID / Driver's License</label>
                        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg px-3 py-4 cursor-pointer transition-colors ${waitlistIdFile ? 'border-[#10b981] bg-[#10b981]/5' : waitlistVerifyResult?.failed_doc === 'id' ? 'border-red-500/50' : 'border-[#1e2d45] hover:border-[#3b82f6]/50'}`}>
                          <input type="file" accept="image/*" className="hidden" onChange={e => setWaitlistIdFile(e.target.files[0])} required />
                          {waitlistIdFile ? (
                            <><div className="text-[#10b981] text-lg mb-1">✓</div><div className="text-xs text-[#10b981] text-center truncate max-w-full">{waitlistIdFile.name}</div></>
                          ) : (
                            <><div className="text-2xl mb-1">🪪</div><div className="text-xs text-[#64748b] text-center">Tap to upload ID</div></>
                          )}
                        </label>
                      </div>
                    </div>
                    <p className="text-[#475569] text-xs">Your documents are analyzed by AI and never stored on our servers.</p>

                    <button
                      type="submit"
                      disabled={waitlistState === 'submitting'}
                      className="w-full bg-[#3b82f6] text-white font-bold py-3 rounded-lg text-sm hover:bg-[#2563eb] disabled:opacity-50 transition-all"
                    >
                      {waitlistState === 'submitting' ? 'Verifying & Joining...' : 'Verify & Join Waitlist →'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Always-visible fallback links */}
          <div className="mt-6 bg-[#111827] border border-[#1e2d45] rounded-xl p-5">
            <div className="font-mono text-[10px] tracking-[2px] text-[#64748b] uppercase mb-3">Other Resources While You Wait</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <a
                href={`https://www.goodrx.com/drugs/search?query=${encodeURIComponent(form.drug_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-[#1a2235] hover:bg-[#1e2d45] rounded-lg px-4 py-3 group transition-all"
              >
                <span className="text-xl">💊</span>
                <div>
                  <div className="text-sm font-semibold text-white">GoodRx Coupon</div>
                  <div className="text-xs text-[#64748b]">Discounted price at retail pharmacies</div>
                </div>
              </a>
              <a
                href="https://www.needymeds.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-[#1a2235] hover:bg-[#1e2d45] rounded-lg px-4 py-3 group transition-all"
              >
                <span className="text-xl">🏥</span>
                <div>
                  <div className="text-sm font-semibold text-white">Manufacturer PAPs</div>
                  <div className="text-xs text-[#64748b]">Free drug programs from manufacturers</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* How it works — shown before search */}
      {!results && (
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            { icon: '🔍', label: 'Search', desc: 'Enter your medication and zip code to see what\'s available at free clinics near you.' },
            { icon: '📧', label: 'Get Notified', desc: 'Not in stock? Join the waitlist. We\'ll email you instantly when it becomes available.' },
            { icon: '🏥', label: 'Pick Up Free', desc: 'Visit the clinic with your prescription and ID. The pharmacist dispenses at no cost.' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="bg-[#111827] border border-[#1e2d45] rounded-xl p-5 text-center">
              <div className="text-3xl mb-3">{icon}</div>
              <div className="text-white font-semibold text-sm mb-2">{label}</div>
              <div className="text-[#64748b] text-xs leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
