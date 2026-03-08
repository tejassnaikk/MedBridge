'use client';

import { useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_HOURS = { Mon: '8am–5pm', Tue: '8am–5pm', Wed: '8am–5pm', Thu: '8am–5pm', Fri: '8am–5pm', Sat: 'Closed', Sun: 'Closed' };

export default function RegisterClinic() {
  const [step, setStep] = useState('form'); // form | submitting | done | error
  const [result, setResult] = useState(null);
  const [hours, setHours] = useState({ ...DEFAULT_HOURS });

  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    zip: '',
    contact_phone: '',
    contact_email: '',
    notes: '',
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleHours = (day, val) => setHours(h => ({ ...h, [day]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStep('submitting');
    try {
      const res = await fetch('/api/register-clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, hours }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setStep('done');
      } else {
        setResult(data);
        setStep('error');
      }
    } catch {
      setResult({ error: 'Network error. Please try again.' });
      setStep('error');
    }
  };

  if (step === 'done') {
    return (
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="bg-[#111827] border border-[#10b981]/30 rounded-xl p-8">
          <div className="text-5xl mb-4">✅</div>
          <div className="font-mono text-[10px] tracking-[2px] text-[#10b981] uppercase mb-3">Registration Submitted</div>
          <h2 className="text-xl font-bold text-white mb-3">{form.name}</h2>
          <p className="text-[#64748b] text-sm mb-6">{result?.message}</p>
          <div className="bg-[#1a2235] rounded-lg p-4 text-left text-sm text-[#64748b] mb-6">
            <p className="mb-1"><strong className="text-white">Next steps:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>A MedBridge admin will verify your clinic details</li>
              <li>Once approved, your clinic becomes visible to donors and patients</li>
              <li>You'll receive confirmation at <strong className="text-[#00d4aa]">{form.contact_email || 'your email'}</strong></li>
            </ul>
          </div>
          <a href="/" className="text-[#00d4aa] text-sm hover:underline">← Back to MedBridge</a>
        </div>
      </main>
    );
  }

  if (step === 'error') {
    return (
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-white font-semibold text-lg mb-2">Registration Failed</div>
        <p className="text-[#64748b] text-sm mb-6">{result?.error}</p>
        <button onClick={() => setStep('form')} className="text-[#00d4aa] text-sm hover:underline">← Try again</button>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[3px] text-[#8b5cf6] border border-[#8b5cf6]/40 px-3 py-1 rounded-sm mb-4 uppercase inline-block">
          Clinic Network
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Register Your Clinic</h1>
        <p className="text-[#64748b] text-sm leading-relaxed">
          Free clinics and community health centers can join the MedBridge network to receive donated medications for uninsured patients.
          Registration is reviewed and approved within 1–2 business days.
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-[#111827] border border-[#8b5cf6]/20 rounded-xl px-5 py-4 mb-6 text-sm text-[#64748b] leading-relaxed">
        <strong className="text-white">Who can register?</strong> Federally-qualified health centers (FQHCs), free clinics, community health centers,
        and nonprofit pharmacies serving uninsured or low-income patients in Colorado.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6 space-y-4">
          <div className="font-mono text-[10px] tracking-[2px] text-[#8b5cf6] uppercase mb-1">Clinic Information</div>

          <div>
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Clinic Name *</label>
            <input value={form.name} onChange={set('name')} required
              placeholder="e.g. Rocky Mountain Free Clinic"
              className="w-full px-3 py-2.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#8b5cf6]/50" />
          </div>

          <div>
            <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Street Address *</label>
            <input value={form.address} onChange={set('address')} required
              placeholder="e.g. 123 Main St"
              className="w-full px-3 py-2.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#8b5cf6]/50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">City *</label>
              <input value={form.city} onChange={set('city')} required
                placeholder="e.g. Denver"
                className="w-full px-3 py-2.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#8b5cf6]/50" />
            </div>
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">ZIP Code *</label>
              <input value={form.zip} onChange={set('zip')} required
                placeholder="e.g. 80204" maxLength={5}
                className="w-full px-3 py-2.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#8b5cf6]/50" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6 space-y-4">
          <div className="font-mono text-[10px] tracking-[2px] text-[#8b5cf6] uppercase mb-1">Contact Details</div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Phone Number</label>
              <input value={form.contact_phone} onChange={set('contact_phone')}
                placeholder="e.g. 303-555-0100"
                className="w-full px-3 py-2.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#8b5cf6]/50" />
            </div>
            <div>
              <label className="block text-xs text-[#64748b] mb-1.5 font-mono">Email</label>
              <input type="email" value={form.contact_email} onChange={set('contact_email')}
                placeholder="e.g. info@clinic.org"
                className="w-full px-3 py-2.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#8b5cf6]/50" />
            </div>
          </div>
        </div>

        {/* Hours */}
        <div className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6">
          <div className="font-mono text-[10px] tracking-[2px] text-[#8b5cf6] uppercase mb-4">Operating Hours</div>
          <div className="space-y-2">
            {DAYS.map(day => (
              <div key={day} className="flex items-center gap-3">
                <span className="text-xs font-mono text-[#64748b] w-8">{day}</span>
                <input
                  value={hours[day]}
                  onChange={e => handleHours(day, e.target.value)}
                  placeholder="e.g. 8am–5pm or Closed"
                  className="flex-1 px-3 py-1.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#8b5cf6]/50"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-[#374151] mt-3">Type "Closed" for days you are not open.</p>
        </div>

        {/* Notes */}
        <div className="bg-[#111827] border border-[#1e2d45] rounded-xl p-6">
          <div className="font-mono text-[10px] tracking-[2px] text-[#8b5cf6] uppercase mb-3">Additional Notes</div>
          <textarea value={form.notes} onChange={set('notes')} rows={3}
            placeholder="Any additional details about your clinic, patient population, or medication needs..."
            className="w-full px-3 py-2.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg text-sm text-white placeholder-[#374151] focus:outline-none focus:border-[#8b5cf6]/50 resize-none" />
        </div>

        <button type="submit" disabled={step === 'submitting'}
          className="w-full bg-[#8b5cf6] text-white font-bold py-3.5 rounded-xl text-sm hover:bg-[#7c3aed] disabled:opacity-50 transition-all">
          {step === 'submitting' ? 'Submitting...' : 'Submit Registration →'}
        </button>

        <p className="text-[#64748b] text-xs text-center">
          Already in the network?{' '}
          <a href="/clinic" className="text-[#8b5cf6] hover:underline">Access the clinic portal →</a>
        </p>
      </form>
    </main>
  );
}
