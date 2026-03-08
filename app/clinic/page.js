'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_COLORS = {
  available: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20',
  reserved:  'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20',
  dispensed: 'text-[#64748b] bg-[#1a2235] border-[#1e2d45]',
};

export default function ClinicPortal() {
  const [username, setUsername] = useState('');
  const [auth, setAuth] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [clinicId, setClinicId] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [waitlistCounts, setWaitlistCounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allClinics, setAllClinics] = useState([]);
  const [clinicSearch, setClinicSearch] = useState('');
  const [showClinicList, setShowClinicList] = useState(false);
  const [pendingClinics, setPendingClinics] = useState([]);
  const [hrsaStatus, setHrsaStatus] = useState(null);
  const [hrsaSyncing, setHrsaSyncing] = useState(false);
  const [hrsaMsg, setHrsaMsg] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pendingDonations, setPendingDonations] = useState([]);

  // Load all verified clinics after login (for the admin dropdown)
  useEffect(() => {
    if (!authed) return;
    fetch('/api/clinic-list').then(r => r.json()).then(d => {
      if (d.clinics?.length) {
        setAllClinics(d.clinics);
        setClinicId(d.clinics[0].id);
        setClinicSearch(d.clinics[0].name + ' — ' + d.clinics[0].city);
      }
    }).catch(() => {});
  }, [authed]);

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
        setTransactions(data.transactions || []);
        setPendingDonations(data.pendingDonations || []);
      }
    } finally {
      setLoading(false);
    }
  }, [clinicId, auth]);

  const loadAdminData = useCallback(async () => {
    const [pendingRes, hrsaRes, activityRes] = await Promise.all([
      fetch('/api/register-clinic', { headers: { 'x-clinic-auth': auth } }),
      fetch('/api/hrsa-sync', { headers: { 'x-clinic-auth': auth } }),
      fetch('/api/admin-activity', { headers: { 'x-clinic-auth': auth } }),
    ]);
    if (pendingRes.ok) {
      const d = await pendingRes.json();
      setPendingClinics(d.pending || []);
    }
    if (hrsaRes.ok) {
      const d = await hrsaRes.json();
      setHrsaStatus(d);
    }
    if (activityRes.ok) {
      const d = await activityRes.json();
      setActivityLog(d.events || []);
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
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: auth }),
    });
    if (res.ok) { setAuthed(true); setAuthError(''); }
    else setAuthError('Invalid credentials. Access restricted to superadmin.');
  };

  const handleApproveDonation = async (inventoryId, action) => {
    await fetch('/api/approve-donation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clinic-auth': auth },
      body: JSON.stringify({ inventory_id: inventoryId, action }),
    });
    await loadInventory();
  };

  const handleMarkDispensed = async (inventoryId) => {
    if (!confirm('Mark this medication as dispensed to the patient?')) return;
    const res = await fetch('/api/mark-dispensed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clinic-auth': auth },
      body: JSON.stringify({ inventory_id: inventoryId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert('Error: ' + (err.error || 'Could not mark as dispensed'));
    }
    await loadInventory();
  };

  // ── Login ────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="max-w-md mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <div className="inline-block font-mono text-[10px] tracking-[3px] text-[#8b5cf6] border border-[#8b5cf6]/40 px-3 py-1 rounded-sm mb-4 uppercase">
            Admin Portal
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Login</h1>
          <p className="text-[#64748b] text-sm">Restricted access. Authorised personnel only.</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">User ID</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter admin user ID"
              autoComplete="username"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#1a2235] border border-[#1e2d45] text-white placeholder-[#64748b] focus:outline-none focus:border-[#8b5cf6]"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Password</label>
            <input
              type="password"
              value={auth}
              onChange={e => setAuth(e.target.value)}
              placeholder="Enter admin password"
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#1a2235] border border-[#1e2d45] text-white placeholder-[#64748b] focus:outline-none focus:border-[#8b5cf6]"
              required
            />
            {authError && <p className="text-red-400 text-xs mt-1">{authError}</p>}
          </div>
          <button type="submit" className="w-full bg-[#8b5cf6] text-white font-bold py-3 rounded-lg text-sm hover:bg-[#7c3aed] transition-all">
            Sign In
          </button>
        </form>
      </main>
    );
  }

  const stats = {
    available: inventory.filter(i => i.status === 'available').length,
    reserved:  inventory.filter(i => i.status === 'reserved').length,
    dispensed: inventory.filter(i => i.dispensed_quantity > 0).length,
    unitsDispensed: inventory.reduce((sum, i) => sum + (i.dispensed_quantity || 0), 0),
    pending: pendingDonations.length,
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
          {/* Searchable clinic picker */}
          <div className="relative">
            <div className="flex items-center bg-[#1a2235] border border-[#1e2d45] rounded-lg overflow-hidden focus-within:border-[#8b5cf6] transition-colors">
              <span className="pl-3 text-[#64748b] text-sm select-none">🔍</span>
              <input
                type="text"
                value={clinicSearch}
                onChange={e => { setClinicSearch(e.target.value); setShowClinicList(true); }}
                onFocus={() => setShowClinicList(true)}
                onBlur={() => setTimeout(() => setShowClinicList(false), 150)}
                placeholder={`Search ${allClinics.length} clinics…`}
                className="px-2 py-2 text-sm bg-transparent text-white placeholder-[#64748b] focus:outline-none w-56"
              />
              {clinicSearch && (
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); setClinicSearch(''); setShowClinicList(true); }}
                  className="pr-3 text-[#64748b] hover:text-white transition-colors text-base leading-none"
                  title="Clear"
                >
                  ×
                </button>
              )}
            </div>

            {showClinicList && (
              <div className="absolute right-0 z-20 mt-1 w-72 bg-[#1a2235] border border-[#1e2d45] rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                {(() => {
                  const q = clinicSearch.toLowerCase();
                  const filtered = allClinics.filter(c =>
                    !q ||
                    c.name.toLowerCase().includes(q) ||
                    c.city.toLowerCase().includes(q)
                  );
                  return filtered.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[#64748b]">No clinics match "{clinicSearch}"</div>
                  ) : (
                    <>
                      <div className="px-3 pt-2 pb-1 text-[10px] font-mono text-[#64748b] uppercase tracking-widest border-b border-[#1e2d45]">
                        {filtered.length} clinic{filtered.length !== 1 ? 's' : ''} found
                      </div>
                      {filtered.slice(0, 60).map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => {
                            setClinicId(c.id);
                            setClinicSearch(c.name + ' — ' + c.city);
                            setShowClinicList(false);
                          }}
                          className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors hover:bg-[#8b5cf6]/20 ${c.id === clinicId ? 'bg-[#8b5cf6]/10' : ''}`}
                        >
                          <div>
                            <div className={`text-sm font-medium ${c.id === clinicId ? 'text-[#8b5cf6]' : 'text-white'}`}>{c.name}</div>
                            <div className="text-xs text-[#64748b]">{c.city}</div>
                          </div>
                          {c.id === clinicId && <span className="text-[#8b5cf6] text-xs">✓</span>}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <button onClick={loadInventory} className="text-xs text-[#64748b] hover:text-[#e2e8f0] border border-[#1e2d45] px-3 py-2 rounded-lg whitespace-nowrap">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending',   value: stats.pending,   color: '#f59e0b', sub: 'Awaiting inspection' },
          { label: 'Available', value: stats.available, color: '#10b981', sub: 'Approved & ready' },
          { label: 'Reserved',  value: stats.reserved,  color: '#3b82f6', sub: 'Patient notified' },
          { label: 'Dispensed', value: stats.dispensed, color: '#64748b', sub: `${stats.unitsDispensed} units given out` },
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
          When a donor completes drop-off at <a href="/donor" className="text-[#10b981] hover:underline">medbridge.com/donor</a>,
          the donation appears below as <strong className="text-[#f59e0b]">Pending</strong>.
          A staff member physically inspects each item, then <strong className="text-white">Approves</strong> to add it to inventory or <strong className="text-white">Rejects</strong> if ineligible.
        </div>
      </div>

      {/* Pending Donations */}
      {pendingDonations.length > 0 && (
        <div className="bg-[#111827] border border-[#f59e0b]/30 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-[#f59e0b]/20 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[2px] text-[#f59e0b] uppercase">Pending Donations — Awaiting Physical Inspection</div>
              <p className="text-xs text-[#64748b] mt-0.5">Inspect each item in person before approving. Check drug name, expiry, seal, and REMS status.</p>
            </div>
            <span className="text-[10px] font-mono text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 px-2 py-1 rounded-full">{pendingDonations.length} waiting</span>
          </div>
          <div className="divide-y divide-[#1e2d45]">
            {pendingDonations.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#1a2235]/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{item.drug_name}</span>
                    <span className="text-[#64748b] text-sm">{item.strength}</span>
                    <span className="text-[#64748b] text-xs bg-[#1a2235] px-2 py-0.5 rounded-md">{item.form}</span>
                  </div>
                  <div className="text-xs text-[#64748b] mt-1 flex gap-4">
                    <span>{item.quantity} units</span>
                    <span>Expires {item.expiry_date}</span>
                    <span>Received {item.date_received ? new Date(item.date_received).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveDonation(item.id, 'approve')}
                    className="text-xs bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-3 py-1.5 rounded-lg hover:bg-[#10b981]/20 transition-all"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleApproveDonation(item.id, 'reject')}
                    className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <td className="px-4 py-3 font-mono">
                      <span className="text-[#64748b]">{item.quantity}</span>
                      {item.quantity_requested && item.status === 'reserved' && (
                        <span className="text-[#f59e0b] text-xs ml-1">(req: {item.quantity_requested})</span>
                      )}
                      {item.dispensed_quantity && item.status === 'dispensed' && (
                        <span className="text-[#10b981] text-xs ml-1">(gave: {item.dispensed_quantity})</span>
                      )}
                    </td>
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

      {/* Dispensed Transactions */}
      {transactions.length > 0 && (
        <div className="bg-[#111827] border border-[#1e2d45] rounded-xl overflow-hidden mt-8">
          <div className="px-5 py-4 border-b border-[#1e2d45] flex items-center justify-between">
            <div className="font-mono text-[10px] tracking-[2px] text-[#64748b] uppercase">Dispensed Transactions</div>
            <span className="text-[10px] font-mono text-[#64748b]">{transactions.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2d45]">
                  {['Drug', 'Strength', 'Qty Dispensed', 'Patient Email', 'Date', 'Remaining'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-mono text-[#64748b] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const invItem = inventory.find(inv => inv.id === tx.inventory_id);
                  const remaining = invItem?.status === 'available' ? invItem.quantity : 0;
                  return (
                    <tr key={i} className="border-b border-[#1e2d45]/50 hover:bg-[#1a2235]/50 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{tx.drug_name}</td>
                      <td className="px-4 py-3 text-[#64748b]">{tx.strength}</td>
                      <td className="px-4 py-3 font-mono text-[#10b981] font-bold">{tx.qty_dispensed}</td>
                      <td className="px-4 py-3 text-[#64748b] text-xs">{tx.patient_email || '—'}</td>
                      <td className="px-4 py-3 text-[#64748b] font-mono text-xs">
                        {tx.dispensed_at ? new Date(tx.dispensed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {remaining > 0
                          ? <span className="text-[#10b981]">{remaining} units back in stock</span>
                          : <span className="text-[#64748b]">fully dispensed</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Log */}
      {activityLog.length > 0 && (
        <div className="bg-[#111827] border border-[#1e2d45] rounded-xl overflow-hidden mt-8">
          <div className="px-5 py-4 border-b border-[#1e2d45] flex items-center justify-between">
            <div className="font-mono text-[10px] tracking-[2px] text-[#64748b] uppercase">Activity Log</div>
            <span className="text-[10px] font-mono text-[#64748b]">{activityLog.length} events</span>
          </div>
          <div className="divide-y divide-[#1e2d45]">
            {activityLog.map((ev, i) => {
              const cfg = {
                donation: { dot: '#10b981', label: 'APPROVED',  labelColor: '#10b981' },
                pending:  { dot: '#f59e0b', label: 'PENDING',   labelColor: '#f59e0b' },
                rejected: { dot: '#ef4444', label: 'REJECTED',  labelColor: '#ef4444' },
                waitlist: { dot: '#3b82f6', label: 'WAITLIST',  labelColor: '#3b82f6' },
                match:    { dot: '#f59e0b', label: 'MATCHED',   labelColor: '#f59e0b' },
                pickup:   { dot: '#8b5cf6', label: 'PICKUP',    labelColor: '#8b5cf6' },
              }[ev.type] || { dot: '#64748b', label: ev.type.toUpperCase(), labelColor: '#64748b' };
              return (
                <div key={i} className="flex items-start gap-4 px-5 py-3 hover:bg-[#1a2235]/40 transition-colors">
                  <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[9px] tracking-widest font-bold" style={{ color: cfg.labelColor }}>{cfg.label}</span>
                      <span className="text-sm text-white">{ev.label}</span>
                    </div>
                    <div className="text-xs text-[#64748b] mt-0.5">{ev.sub}</div>
                  </div>
                  <div className="text-[11px] font-mono text-[#475569] shrink-0 mt-0.5">
                    {ev.time ? new Date(ev.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
