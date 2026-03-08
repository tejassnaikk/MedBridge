'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_COLORS = {
  available: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20',
  reserved:  'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20',
  dispensed: 'text-[#64748b] bg-[#1a2235] border-[#1e2d45]',
};

export default function ClinicPortal() {
  const [auth, setAuth] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [clinicId, setClinicId] = useState(1);
  const [inventory, setInventory] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [waitlistCounts, setWaitlistCounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allClinics, setAllClinics] = useState([]);
  const [pendingClinics, setPendingClinics] = useState([]);
  const [hrsaStatus, setHrsaStatus] = useState(null);
  const [hrsaSyncing, setHrsaSyncing] = useState(false);
  const [hrsaMsg, setHrsaMsg] = useState('');

  // Load all verified clinics for the login dropdown (no auth needed)
  useEffect(() => {
    fetch('/api/clinic-list').then(r => r.json()).then(d => {
      if (d.clinics?.length) {
        setAllClinics(d.clinics);
        setClinicId(d.clinics[0].id);
      }
    }).catch(() => {});
  }, []);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinic-inventory?clinic_id=${clinicId}`, {
        headers: { 'x-clinic-auth': auth },
      });
      const data = await res.json();
      if (res.ok) {
        setInventory(data.inventory || []);
        setClinics(data.clinics || []);
        setWaitlistCounts(data.waitlistCounts || []);
      }
    } finally {
      setLoading(false);
    }
  }, [clinicId, auth]);

  const loadAdminData = useCallback(async () => {
    const [pendingRes, hrsaRes] = await Promise.all([
      fetch('/api/register-clinic', { headers: { 'x-clinic-auth': auth } }),
      fetch('/api/hrsa-sync', { headers: { 'x-clinic-auth': auth } }),
    ]);
    if (pendingRes.ok) {
      const d = await pendingRes.json();
      setPendingClinics(d.pending || []);
    }
    if (hrsaRes.ok) {
      const d = await hrsaRes.json();
      setHrsaStatus(d);
    }
  }, [auth]);

  const handleHrsaSync = async () => {
    setHrsaSyncing(true);
    setHrsaMsg('');
    try {
      const res = await fetch('/api/hrsa-sync', {
        method: 'POST',
        headers: { 'x-clinic-auth': auth },
      });
      const data = await res.json();
      setHrsaMsg(data.message || data.error);
      loadAdminData();
      loadInventory();
    } finally {
      setHrsaSyncing(false);
    }
  };

  const handleApprove = async (clinicId, action) => {
    await fetch('/api/approve-clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clinic-auth': auth },
      body: JSON.stringify({ clinic_id: clinicId, action }),
    });
    loadAdminData();
  };

  useEffect(() => {
    if (authed) { loadInventory(); loadAdminData(); }
  }, [authed, loadInventory, loadAdminData]);

  // Auto-refresh every 15 seconds to pick up new donations
  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(loadInventory, 15000);
    return () => clearInterval(interval);
  }, [authed, loadInventory]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/clinic-inventory?clinic_id=${clinicId}`, {
      headers: { 'x-clinic-auth': auth },
    });
    if (res.ok) { setAuthed(true); setAuthError(''); }
    else setAuthError('Incorrect password. Try: medbridge2024');
  };

  const handleMarkDispensed = async (inventoryId) => {
    if (!confirm('Mark this medication as dispensed to the patient?')) return;
    await fetch('/api/mark-dispensed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clinic-auth': auth },
      body: JSON.stringify({ inventory_id: inventoryId }),
    });
    await loadInventory();
  };

  // ── Login ────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="max-w-md mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <div className="inline-block font-mono text-[10px] tracking-[3px] text-[#8b5cf6] border border-[#8b5cf6]/40 px-3 py-1 rounded-sm mb-4 uppercase">
            Clinic Portal
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Clinic Staff Login</h1>
          <p className="text-[#64748b] text-sm">View live inventory and confirm medication dispensing.</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Clinic</label>
            <select value={clinicId} onChange={e => setClinicId(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg text-sm">
              {allClinics.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.city}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Staff Password</label>
            <input type="password" value={auth} onChange={e => setAuth(e.target.value)}
              placeholder="Enter clinic password" className="w-full px-3 py-2.5 rounded-lg text-sm" required />
            {authError && <p className="text-red-400 text-xs mt-1">{authError}</p>}
          </div>
          <button type="submit" className="w-full bg-[#8b5cf6] text-white font-bold py-3 rounded-lg text-sm hover:bg-[#7c3aed] transition-all">
            Enter Portal
          </button>
          <p className="text-[#64748b] text-xs text-center">Demo password: <code className="text-[#00d4aa]">medbridge2024</code></p>
        </form>
      </main>
    );
  }

  const stats = {
    available: inventory.filter(i => i.status === 'available').length,
    reserved:  inventory.filter(i => i.status === 'reserved').length,
    dispensed: inventory.filter(i => i.status === 'dispensed').length,
  };

  const currentClinic = clinics.find(c => c.id === clinicId);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-mono text-[10px] tracking-[2px] text-[#8b5cf6] uppercase mb-1">Live Dashboard</div>
          <h1 className="text-2xl font-bold text-white">{currentClinic?.name || 'Clinic Dashboard'}</h1>
          <p className="text-[#64748b] text-sm mt-1">{currentClinic?.address}, {currentClinic?.city} · Auto-refreshes every 15s</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={clinicId} onChange={e => setClinicId(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm text-[#64748b]">
            {(clinics.length ? clinics : allClinics).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={loadInventory} className="text-xs text-[#64748b] hover:text-[#e2e8f0] border border-[#1e2d45] px-3 py-2 rounded-lg">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Available', value: stats.available, color: '#10b981', sub: 'Donated & ready' },
          { label: 'Reserved', value: stats.reserved,  color: '#f59e0b', sub: 'Patient notified' },
          { label: 'Dispensed', value: stats.dispensed, color: '#64748b', sub: 'Successfully given' },
        ].map(s => (
          <div key={s.label} className="bg-[#111827] border border-[#1e2d45] rounded-xl p-5 text-center">
            <div className="text-3xl font-bold font-mono mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-sm text-white font-medium">{s.label}</div>
            <div className="text-xs text-[#64748b] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Patient waitlist demand */}
      {waitlistCounts.length > 0 && (
        <div className="bg-[#111827] border border-[#3b82f6]/20 rounded-xl p-5 mb-6">
          <div className="font-mono text-[10px] tracking-[2px] text-[#3b82f6] uppercase mb-3">
            Statewide Patient Demand — Waiting for These Medications
          </div>
          <div className="flex flex-wrap gap-2">
            {waitlistCounts.map(w => (
              <div key={`${w.drug_name}-${w.strength}`} className="bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-lg px-3 py-2 text-sm">
                <span className="text-white font-medium">{w.drug_name} {w.strength}</span>
                <span className="text-[#3b82f6] ml-2 font-mono text-xs">{w.count} waiting</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HRSA Sync Panel */}
      <div className="bg-[#111827] border border-[#8b5cf6]/20 rounded-xl px-5 py-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[2px] text-[#8b5cf6] uppercase mb-1">Federal Clinic Network</div>
            <p className="text-sm text-[#64748b]">
              {hrsaStatus ? (
                <>
                  {hrsaStatus.verified_clinics} verified clinics ·{' '}
                  {hrsaStatus.pending_clinics > 0 && (
                    <span className="text-[#f59e0b]">{hrsaStatus.pending_clinics} pending approval · </span>
                  )}
                  {hrsaStatus.hrsa_last_sync
                    ? `Last synced ${new Date(hrsaStatus.hrsa_last_sync).toLocaleString()}`
                    : 'Never synced with HRSA'}
                </>
              ) : 'Pull real Colorado FQHCs from the HRSA federal database.'}
            </p>
            {hrsaMsg && <p className="text-xs text-[#10b981] mt-1">{hrsaMsg}</p>}
          </div>
          <button onClick={handleHrsaSync} disabled={hrsaSyncing}
            className="text-xs bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/30 px-4 py-2 rounded-lg hover:bg-[#8b5cf6]/20 disabled:opacity-50 transition-all whitespace-nowrap">
            {hrsaSyncing ? 'Syncing...' : '↻ Sync HRSA Clinics'}
          </button>
        </div>
      </div>

      {/* Pending clinic approvals */}
      {pendingClinics.length > 0 && (
        <div className="bg-[#111827] border border-[#f59e0b]/20 rounded-xl p-5 mb-6">
          <div className="font-mono text-[10px] tracking-[2px] text-[#f59e0b] uppercase mb-3">
            Pending Clinic Registrations — {pendingClinics.length} awaiting review
          </div>
          <div className="space-y-3">
            {pendingClinics.map(c => (
              <div key={c.id} className="flex items-start justify-between gap-4 bg-[#1a2235] rounded-lg p-3">
                <div className="text-sm">
                  <div className="text-white font-medium">{c.name}</div>
                  <div className="text-[#64748b] text-xs mt-0.5">{c.address}, {c.city} {c.zip}</div>
                  {c.contact_phone && <div className="text-[#64748b] text-xs">{c.contact_phone}</div>}
                  {c.notes && <div className="text-[#64748b] text-xs mt-1 italic">{c.notes}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleApprove(c.id, 'approve')}
                    className="text-xs bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-3 py-1.5 rounded-lg hover:bg-[#10b981]/20 transition-all">
                    Approve
                  </button>
                  <button onClick={() => handleApprove(c.id, 'reject')}
                    className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How inventory gets here */}
      <div className="bg-[#111827] border border-[#10b981]/20 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
        <span className="text-2xl">💊</span>
        <div className="text-sm text-[#64748b] leading-relaxed">
          Inventory updates automatically when a <strong className="text-white">donor completes the drop-off flow</strong> at{' '}
          <a href="/donor" className="text-[#10b981] hover:underline">medbridge.com/donor</a>.
          No manual entry needed — new donations appear here in real time.
        </div>
      </div>

      {/* Inventory table */}
      <div className="bg-[#111827] border border-[#1e2d45] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2d45]">
          <div className="font-mono text-[10px] tracking-[2px] text-[#64748b] uppercase">Current Inventory</div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#64748b] text-sm">Loading...</div>
        ) : inventory.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-[#64748b] text-sm mb-2">No inventory yet for this clinic.</div>
            <a href="/donor" className="text-[#10b981] text-sm hover:underline">Share the donor link to receive donations →</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2d45]">
                  {['Drug', 'Strength', 'Form', 'Qty', 'Expires', 'Received', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-mono text-[#64748b] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => (
                  <tr key={item.id} className="border-b border-[#1e2d45]/50 hover:bg-[#1a2235]/50 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{item.drug_name}</td>
                    <td className="px-4 py-3 text-[#64748b]">{item.strength}</td>
                    <td className="px-4 py-3 text-[#64748b]">{item.form}</td>
                    <td className="px-4 py-3 text-[#64748b] font-mono">{item.quantity}</td>
                    <td className="px-4 py-3 text-[#64748b] font-mono text-xs">{item.expiry_date}</td>
                    <td className="px-4 py-3 text-[#64748b] font-mono text-xs">
                      {item.date_received ? new Date(item.date_received).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${STATUS_COLORS[item.status] || ''}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'reserved' && (
                        <button onClick={() => handleMarkDispensed(item.id)}
                          className="text-xs bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-3 py-1 rounded-lg hover:bg-[#10b981]/20 transition-all">
                          Mark Dispensed
                        </button>
                      )}
                      {item.status === 'available' && <span className="text-xs text-[#1e2d45]">Awaiting match</span>}
                      {item.status === 'dispensed' && <span className="text-xs text-[#64748b]">✓ Complete</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
