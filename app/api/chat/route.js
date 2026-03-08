import { NextResponse } from 'next/server';
import { dbAll } from '../../../lib/db.js';

const MODEL = 'llama-3.3-70b-versatile';

// Common brand → generic mappings so users can ask about brand names
const BRAND_MAP = {
  crocin: 'paracetamol', panadol: 'paracetamol', tylenol: 'acetaminophen',
  advil: 'ibuprofen', motrin: 'ibuprofen', nurofen: 'ibuprofen',
  aleve: 'naproxen', naprosyn: 'naproxen',
  lipitor: 'atorvastatin', zocor: 'simvastatin', crestor: 'rosuvastatin',
  pravachol: 'pravastatin', mevacor: 'lovastatin',
  glucophage: 'metformin', glucotrol: 'glipizide', amaryl: 'glimepiride',
  januvia: 'sitagliptin', tradjenta: 'linagliptin',
  prinivil: 'lisinopril', zestril: 'lisinopril',
  norvasc: 'amlodipine', 'plendil': 'felodipine',
  lopressor: 'metoprolol', 'toprol-xl': 'metoprolol', toprol: 'metoprolol',
  cozaar: 'losartan', diovan: 'valsartan', avapro: 'irbesartan',
  synthroid: 'levothyroxine', levoxyl: 'levothyroxine', tirosint: 'levothyroxine',
  prilosec: 'omeprazole', nexium: 'esomeprazole', prevacid: 'lansoprazole',
  protonix: 'pantoprazole', aciphex: 'rabeprazole',
  pepcid: 'famotidine', zantac: 'ranitidine', tagamet: 'cimetidine',
  zithromax: 'azithromycin', cipro: 'ciprofloxacin', amoxil: 'amoxicillin',
  keflex: 'cephalexin', bactrim: 'sulfamethoxazole', augmentin: 'amoxicillin clavulanate',
  zofran: 'ondansetron', phenergan: 'promethazine',
  singulair: 'montelukast', flovent: 'fluticasone', ventolin: 'albuterol', proventil: 'albuterol',
  prozac: 'fluoxetine', zoloft: 'sertraline', lexapro: 'escitalopram',
  celexa: 'citalopram', effexor: 'venlafaxine', cymbalta: 'duloxetine',
  wellbutrin: 'bupropion', zyban: 'bupropion',
  celebrex: 'celecoxib', voltaren: 'diclofenac', feldene: 'piroxicam',
  glucocil: 'berberine', lasix: 'furosemide', bumex: 'bumetanide',
  coumadin: 'warfarin', plavix: 'clopidogrel',
};

const SKIP_WORDS = new Set([
  'is','are','the','a','an','can','i','get','find','have','do','you','we',
  'available','any','some','need','want','looking','for','medicine','medication',
  'drug','tablet','pill','capsule','what','how','where','when','which','who',
  'at','in','on','to','of','and','or','but','not','my','your','their','its',
  'near','nearby','close','here','there','mg','mcg','ml','please','help',
  'tell','me','about','check','see','if','currently','stock','right','now',
  'queue','waitlist','wait','list','position','number','order','place','rank',
  'status','update','notification','notify','notified','am','was','been',
  'that','this','these','those','would','could','should','will','join','sign',
]);

function normalize(name) {
  const lower = name.toLowerCase().trim();
  return BRAND_MAP[lower] || lower;
}

function tokenize(text) {
  return text.toLowerCase().replace(/[?,!.()\n]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !SKIP_WORDS.has(w));
}

function inventoryMatch(item, term) {
  const normalized = normalize(term);
  const itemName = item.drug_name.toLowerCase();
  return (
    itemName.includes(normalized) ||
    normalized.includes(itemName) ||
    itemName.includes(term.toLowerCase()) ||
    term.toLowerCase().includes(itemName)
  );
}

function formatHours(hoursObj) {
  if (!hoursObj || typeof hoursObj !== 'object') return 'Call to confirm';
  return Object.entries(hoursObj)
    .map(([day, h]) => `${day}: ${h}`)
    .join(', ');
}

function buildLiveContext(userMessage) {
  const tokens = tokenize(userMessage);
  const allInventory = dbAll('inventory');
  const allClinics = dbAll('clinics');
  const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

  const available = allInventory.filter(i => i.status === 'available');
  const reserved  = allInventory.filter(i => i.status === 'reserved');
  const pending   = allInventory.filter(i => i.status === 'pending');

  const lines = [];

  // ── Platform summary (always included) ───────────────────────────────────
  const uniqueDrugs = [...new Set(available.map(i => `${i.drug_name} ${i.strength}`))];
  lines.push(`PLATFORM STATS (live):
- Available medications: ${available.length} items (${uniqueDrugs.length} unique drug+strength combos)
- Reserved: ${reserved.length} | Pending inspection: ${pending.length}
- Verified clinics: ${allClinics.filter(c => c.is_verified).length}
- Today is: ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]}`);

  // ── Full available inventory list ─────────────────────────────────────────
  if (available.length > 0) {
    const inventoryLines = available.map(item => {
      const clinic = allClinics.find(c => c.id === item.clinic_id);
      const todayHours = clinic?.hours?.[today] || 'Call to confirm';
      return `  • ${item.drug_name} ${item.strength} (${item.form || 'tablet'}) — ${item.quantity} units | Clinic: ${clinic?.name || 'Unknown'}, ${clinic?.city || ''} CO | Phone: ${clinic?.contact_phone || 'N/A'} | Today: ${todayHours} | Expires: ${item.expiry_date}`;
    }).join('\n');
    lines.push(`ALL AVAILABLE INVENTORY:\n${inventoryLines}`);
  } else {
    lines.push('ALL AVAILABLE INVENTORY: No medications currently available.');
  }

  // ── Specific drug search ───────────────────────────────────────────────────
  const drugMatches = [];
  for (const token of tokens) {
    if (token.length < 3) continue;
    const hits = available.filter(item => inventoryMatch(item, token));
    if (hits.length > 0) {
      hits.forEach(item => {
        if (!drugMatches.find(x => x.id === item.id)) drugMatches.push(item);
      });
    }
  }

  if (drugMatches.length > 0) {
    const detailLines = drugMatches.map(item => {
      const clinic = allClinics.find(c => c.id === item.clinic_id);
      const todayHours = clinic?.hours?.[today] || 'Call to confirm';
      const allHours = formatHours(clinic?.hours);
      return `  MATCH: ${item.drug_name} ${item.strength} (${item.form || 'tablet'})
    Quantity: ${item.quantity} units available
    Expires: ${item.expiry_date}
    Clinic: ${clinic?.name || 'Unknown'}
    Address: ${clinic?.address || ''}, ${clinic?.city || ''}, CO ${clinic?.zip || ''}
    Phone: ${clinic?.contact_phone || 'N/A'}
    Today's hours: ${todayHours}
    All hours: ${allHours}`;
    }).join('\n');
    lines.push(`SPECIFIC DRUG SEARCH RESULTS:\n${detailLines}`);
  } else if (tokens.length > 0) {
    // Drug mentioned but not found — check if it's a known non-donatable drug
    const controlled = ['oxycodone','hydrocodone','fentanyl','morphine','codeine','tramadol',
      'alprazolam','xanax','diazepam','valium','lorazepam','ativan','clonazepam','klonopin',
      'amphetamine','adderall','methylphenidate','ritalin','vyvanse','lisdexamfetamine'];
    const mentionedControlled = tokens.filter(t => controlled.some(c => t.includes(c) || c.includes(t)));
    if (mentionedControlled.length > 0) {
      lines.push(`NOTE: ${mentionedControlled.join(', ')} is/are controlled substance(s). MedBridge cannot accept or redistribute controlled substances — this is a strict safety rule.`);
    } else {
      lines.push(`SPECIFIC DRUG SEARCH: No available inventory found for the medication(s) mentioned (${tokens.join(', ')}). Patient can join the waitlist and will be notified when it becomes available within 300 miles.`);
    }
  }

  // ── Waitlist demand snapshot ───────────────────────────────────────────────
  const waitlist = dbAll('waitlist', w => w.status === 'waiting');
  if (waitlist.length > 0) {
    const demand = {};
    waitlist.forEach(w => {
      const key = `${w.drug_name} ${w.strength}`;
      demand[key] = (demand[key] || 0) + 1;
    });
    const demandLines = Object.entries(demand)
      .sort((a,b) => b[1]-a[1])
      .map(([drug, count]) => `  • ${drug}: ${count} patient(s) waiting`)
      .join('\n');
    lines.push(`WAITLIST DEMAND (patients waiting):\n${demandLines}`);
  }

  return lines.join('\n\n');
}

const SYSTEM_PROMPT = `You are MedBridge Assistant — a helpful AI for the MedBridge platform, a Colorado-based free medication redistribution service connecting donated medications to uninsured patients through licensed clinics.

IMPORTANT: You have access to LIVE DATABASE DATA injected below. Use it to give DIRECT, SPECIFIC answers.
- If asked whether a medication is available → simply say "Yes, [Drug Name] is currently available." or "No, [Drug Name] is not in stock right now." Do NOT mention clinic names, addresses, phones, or any location details unprompted.
- If the user then specifically asks WHERE it is available or which clinic has it → guide them to search on the homepage (medbridge platform) with their zip code to find the nearest clinic.
- If medication is NOT available → say it's out of stock and advise joining the waitlist on the homepage.
- Never say "availability changes daily" — just tell them what's actually in stock right now.
- If someone asks "where am I on the queue/waitlist" or "what is my position/status" → explain that the waitlist has no numbered positions. They will be automatically notified by email (and SMS if provided) the moment a matching medication becomes available within 300 miles. They don't need to check back manually.
- Always answer the CURRENT question. Do not carry over topics from previous messages unless the user explicitly refers to them.
- Keep answers SHORT and direct (1–3 sentences).
- Be warm and empathetic.

ABOUT MEDBRIDGE:
• Free platform — no cost to patients, donors, or clinics. Colorado pilot.
• NOT a medical provider — all dispensing done by licensed pharmacists at partner clinics.
• 307+ verified clinics (FQHCs and free clinics across Colorado).

HOW PATIENTS GET MEDICATIONS:
1. Search on the homepage by drug name + zip code.
2. Find a nearby clinic (within 25 miles).
3. Click Reserve → upload prescription photo + government photo ID.
4. AI verifies documents instantly.
5. If approved, medication reserved for 48 hours.
6. Visit clinic within 48 hours — pharmacist dispenses it free.
Requirements: Valid prescription + government-issued photo ID (driver's license or state ID). No insurance needed. Free.

WAITLIST: If out of stock → join waitlist with email (+optional phone). Notified within 300-mile radius when available.

DONORS — HOW TO DONATE:
1. Click "Donate Meds" → pass 5 eligibility checks.
2. Enter medication details → find nearest clinic → drop off in person.
CANNOT DONATE: Opioids (oxycodone, hydrocodone, fentanyl, morphine, codeine, tramadol), benzos (Xanax, Valium, Ativan, Klonopin), stimulants (Adderall, Ritalin, Vyvanse), REMS drugs, controlled substances, opened packaging, items expiring within 6 months, improperly stored meds, injectables/biologics.
CAN DONATE: Any non-controlled prescription med, sealed/original packaging, 6+ months to expiry, properly stored, personal info removed.

CLINICS — HOW TO JOIN:
Click "Join Network" → fill registration form → 1–2 business days review → approved clinics appear on platform. Free. Need licensed pharmacist on staff.

WHAT IS FQHC: Federally Qualified Health Center — federally funded, serves all patients regardless of ability to pay, sliding-scale fees. MedBridge syncs with federal HRSA database.

SAFETY & LEGAL: Colorado-compliant. All meds go through licensed pharmacists. No controlled substances. Patient data minimal and encrypted.

EMERGENCIES: Not for emergencies. Call 911 or go to ER.

MEDICAL ADVICE: Never give dosing/side effect/interaction advice — "Please ask your doctor or pharmacist for medical advice."

UNRELATED QUESTIONS: "I can only help with MedBridge questions."`;

export async function POST(request) {
  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    // Build live context from the latest user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const liveContext = buildLiveContext(lastUserMsg);

    const systemWithData = `${SYSTEM_PROMPT}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\nLIVE DATABASE (use this to answer):\n${liveContext}\n━━━━━━━━━━━━━━━━━━━━━━━━`;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.length < 10) {
      const fallback = `Based on live data: ${liveContext.split('\n')[0]}. For full details, browse the platform or contact a clinic directly.`;
      return new Response(fallback, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemWithData },
          ...messages.slice(-12).map(({ role, content }) => ({ role, content })),
        ],
        max_tokens: 600,
        temperature: 0.5,
        stream: true,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[CHAT API]', groqRes.status, errText.slice(0, 200));
      return NextResponse.json({ error: 'Chat service temporarily unavailable' }, { status: 503 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = groqRes.body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') { controller.close(); return; }
              try {
                const token = JSON.parse(data).choices?.[0]?.delta?.content || '';
                if (token) controller.enqueue(new TextEncoder().encode(token));
              } catch {}
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
    });
  } catch (err) {
    console.error('[CHAT API ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
