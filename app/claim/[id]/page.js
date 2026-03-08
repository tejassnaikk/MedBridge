'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ClaimPage() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | claiming | done | error
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch(`/api/claim?id=${id}`)
      .then(r => r.json())
      .then(data => {
        setInfo(data);
        if (data.status === 'fulfilled') setState('done');
        else if (data.status === 'notified') setState('ready');
        else setState('error');
      })
      .catch(() => setState('error'));
  }, [id]);

  const handleClaim = async () => {
    setState('claiming');
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitlist_id: parseInt(id) }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data);
      setState('done');
    } else {
      setState('error');
    }
  };

  const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

  if (state === 'loading') {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center text-[#64748b]">
        Loading...
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-white font-semibold text-lg mb-2">Reservation not active</div>
        <p className="text-[#64748b] text-sm">This reservation may have expired or already been claimed.</p>
        <a href="/" className="mt-6 inline-block text-[#00d4aa] text-sm hover:underline">Search for other medications →</a>
      </main>
    );
  }

  if (state === 'done') {
    const d = result || info;
    return (
      <main className="max-w-md mx-auto px-4 py-20">
        <div className="bg-[#111827] border border-[#10b981]/30 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <div className="font-mono text-[10px] tracking-[2px] text-[#10b981] uppercase mb-3">Pickup Confirmed</div>
          <h2 className="text-xl font-bold text-white mb-2">
            {d?.drug_name} {d?.strength}
          </h2>
          <p className="text-[#64748b] text-sm mb-4">
            Marked as dispensed at <strong className="text-white">{d?.clinic_name}</strong>.
            Thank you for using MedBridge.
          </p>
          <a href="/" className="text-[#00d4aa] text-sm hover:underline">← Back to MedBridge</a>
        </div>
      </main>
    );
  }

  // state === 'ready'
  const expiresAt = info?.notified_at
    ? new Date(new Date(info.notified_at).getTime() + 48 * 60 * 60 * 1000)
    : null;
  const hoursLeft = expiresAt
    ? Math.max(0, Math.round((expiresAt - Date.now()) / (1000 * 60 * 60)))
    : null;

  return (
    <main className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="font-mono text-[10px] tracking-[3px] text-[#00d4aa] border border-[#00d4aa]/40 px-3 py-1 rounded-sm mb-4 uppercase inline-block">
          Medication Ready
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          {info?.drug_name} {info?.strength}
        </h1>
        <p className="text-[#64748b] text-sm">is waiting for you at:</p>
      </div>

      <div className="bg-[#111827] border border-[#00d4aa]/30 rounded-xl p-6 mb-6">
        <div className="font-semibold text-white text-lg mb-1">{info?.clinic_name}</div>
        <div className="text-[#64748b] text-sm mb-4">{info?.clinic_address}</div>

        {info?.clinic_hours && (
          <div className="flex flex-wrap gap-2 text-xs mb-4">
            {Object.entries(info.clinic_hours).map(([day, hrs]) => (
              <span
                key={day}
                className={`px-2 py-1 rounded-md ${day === today
                  ? 'bg-[#00d4aa]/20 text-[#00d4aa] font-semibold'
                  : 'bg-[#1a2235] text-[#64748b]'}`}
              >
                {day}: {hrs}
              </span>
            ))}
          </div>
        )}

        <div className="bg-[#1a2235] rounded-lg px-4 py-3 text-sm text-[#e2e8f0]">
          Bring your <strong>prescription</strong> + <strong>photo ID</strong>. Medication is free.
        </div>

        {hoursLeft !== null && (
          <div className="mt-3 text-xs text-[#f59e0b] text-center">
            ⏱ {hoursLeft} hours remaining in your claim window
          </div>
        )}
      </div>

      <button
        onClick={handleClaim}
        disabled={state === 'claiming'}
        className="w-full bg-[#00d4aa] text-[#0a0e1a] font-bold py-4 rounded-xl text-base hover:bg-[#00bfa0] disabled:opacity-50 transition-all"
      >
        {state === 'claiming' ? 'Confirming...' : 'I Picked Up My Medication ✓'}
      </button>
      <p className="text-[#64748b] text-xs text-center mt-3">
        Tap this after the pharmacist dispenses your medication to close the loop.
      </p>
    </main>
  );
}
