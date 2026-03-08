'use client';

import { useState } from 'react';

const COMMON_DRUGS = [
  'Metformin', 'Lisinopril', 'Atorvastatin', 'Amlodipine', 'Levothyroxine',
  'Omeprazole', 'Sertraline', 'Metoprolol', 'Losartan', 'Gabapentin',
  'Hydrochlorothiazide', 'Furosemide', 'Pantoprazole', 'Montelukast',
  'Simvastatin', 'Escitalopram', 'Albuterol', 'Duloxetine', 'Fluoxetine',
];

export default function PatientPage() {
  const [form, setForm] = useState({ drug_name: '', strength: '', zip_code: '' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [waitlistForm, setWaitlistForm] = useState({ phone: '', has_rx: false });
  const [waitlistState, setWaitlistState] = useState('idle'); // idle | submitting | done
  const [waitlistResult, setWaitlistResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

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
    setWaitlistState('idle');
    setSuggestions([]);
    try {
      const res = await fetch('/api/search-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setResults(data);
    } catch {
      setResults({ error: 'Failed to search. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async (e) => {
    e.preventDefault();
    setWaitlistState('submitting');
    try {
      const res = await fetch('/api/join-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...waitlistForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWaitlistResult(data);
      setWaitlistState('done');
    } catch (err) {
      alert(err.message);
      setWaitlistState('idle');
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
                  const todayHours = item.hours[today] || 'Closed';
                  return (
                    <div key={item.id} className="bg-[#111827] border border-[#10b981]/30 rounded-xl p-5">
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
                        <span className="bg-[#10b981]/10 text-[#10b981] px-2 py-1 rounded-md">
                          {item.drug_name} {item.strength}
                        </span>
                        <span className="bg-[#1a2235] text-[#64748b] px-2 py-1 rounded-md">
                          {item.quantity} units · {item.form}
                        </span>
                        <span className="bg-[#1a2235] text-[#64748b] px-2 py-1 rounded-md">
                          Today: {todayHours}
                        </span>
                        {item.contact_phone && (
                          <span className="bg-[#1a2235] text-[#64748b] px-2 py-1 rounded-md">
                            {item.contact_phone}
                          </span>
                        )}
                      </div>

                      <div className="bg-[#00d4aa]/10 border border-[#00d4aa]/20 rounded-lg px-4 py-3 text-sm text-[#e2e8f0]">
                        Bring your <strong>prescription</strong> + <strong>photo ID</strong>. Medication is free of charge.
                      </div>
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

              {waitlistState === 'done' ? (
                <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl p-6 text-center">
                  <div className="text-3xl mb-3">✓</div>
                  <div className="text-white font-semibold text-lg mb-2">You're on the waitlist!</div>
                  <div className="text-[#64748b] text-sm leading-relaxed">
                    You are <strong className="text-white">#{waitlistResult?.position}</strong> in line for {form.drug_name} {form.strength}.
                    We'll text you the moment it becomes available within 25 miles.
                  </div>
                </div>
              ) : (
                <div className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6">
                  <div className="text-white font-semibold mb-1">Join the waitlist</div>
                  <div className="text-[#64748b] text-sm mb-5">We'll text you when {form.drug_name}{form.strength ? ` ${form.strength}` : ''} becomes available near you. No account needed.</div>

                  <form onSubmit={handleJoinWaitlist} className="space-y-4">
                    <div>
                      <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Phone Number</label>
                      <input
                        type="tel"
                        value={waitlistForm.phone}
                        onChange={e => setWaitlistForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="(720) 555-0100"
                        className="w-full px-3 py-2.5 rounded-lg text-sm"
                        required
                      />
                      <p className="text-[#64748b] text-xs mt-1">Your number is encrypted and only used to send you one text. Reply STOP to opt out anytime.</p>
                    </div>

                    <label className="flex gap-3 items-start cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={waitlistForm.has_rx}
                        onChange={e => setWaitlistForm(f => ({ ...f, has_rx: e.target.checked }))}
                        className="mt-0.5 rounded accent-[#00d4aa]"
                        required
                      />
                      <span className="text-sm text-[#64748b] group-hover:text-[#e2e8f0] transition-colors">
                        I confirm I have a valid prescription for this medication from a licensed physician.
                        I understand the clinic will verify my prescription in person before dispensing.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={waitlistState === 'submitting'}
                      className="w-full bg-[#3b82f6] text-white font-bold py-3 rounded-lg text-sm hover:bg-[#2563eb] disabled:opacity-50 transition-all"
                    >
                      {waitlistState === 'submitting' ? 'Joining...' : 'Join Waitlist — Get Texted When Available'}
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
            { icon: '📱', label: 'Get Notified', desc: 'Not in stock? Join the waitlist. We\'ll text you instantly when it becomes available.' },
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
