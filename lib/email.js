import { Resend } from 'resend';

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) return null;
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendNotificationEmail(to, { drugName, strength, clinicName, clinicAddress, distanceMiles, todayHours, claimUrl }) {
  const resend = getClient();

  if (!resend) {
    console.log('\n📧 [EMAIL STUB] ─────────────────────────────');
    console.log(`  To:      ${to}`);
    console.log(`  Drug:    ${drugName} ${strength}`);
    console.log(`  Clinic:  ${clinicName} — ${distanceMiles} mi`);
    console.log(`  Claim:   ${claimUrl}`);
    console.log('────────────────────────────────────────────\n');
    return { stub: true };
  }

  const result = await resend.emails.send({
    from: 'MedBridge <onboarding@resend.dev>',
    to,
    subject: `Your medication ${drugName} ${strength} is available — pick up within 48 hrs`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0e1a;color:#e2e8f0;padding:32px;border-radius:12px;">
        <div style="color:#00d4aa;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px;">MedBridge · Free Medication Network</div>
        <h1 style="font-size:22px;margin:0 0 8px;color:#fff;">Good news — your medication is ready!</h1>
        <p style="color:#94a3b8;margin:0 0 24px;">A donation of <strong style="color:#fff;">${drugName} ${strength}</strong> has been reserved for you at a clinic near you.</p>

        <div style="background:#111827;border:1px solid #1e2d45;border-radius:10px;padding:20px;margin-bottom:24px;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Clinic</div>
          <div style="font-size:16px;font-weight:600;color:#fff;">${clinicName}</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:2px;">${clinicAddress} · ${distanceMiles} miles away</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:2px;">Today: ${todayHours}</div>
        </div>

        <div style="background:#00d4aa15;border:1px solid #00d4aa40;border-radius:10px;padding:16px;margin-bottom:24px;font-size:13px;color:#e2e8f0;">
          Bring your <strong>prescription</strong> + <strong>photo ID</strong>. Medication is <strong>100% free</strong>.<br/>
          <strong style="color:#f59e0b;">You have 48 hours to confirm pickup before this reservation expires.</strong>
        </div>

        <a href="${claimUrl}" style="display:block;background:#00d4aa;color:#0a0e1a;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:24px;">
          Confirm Pickup →
        </a>

        <p style="font-size:11px;color:#475569;text-align:center;margin:0;">
          MedBridge · Colorado Free Medication Network<br/>
          You're receiving this because you joined the waitlist. This is a one-time notification.
        </p>
      </div>
    `,
  });

  if (result.error) {
    console.error(`📧 [EMAIL ERROR] to=${to} — ${JSON.stringify(result.error)}`);
    throw new Error(result.error.message);
  }
  console.log(`📧 [EMAIL SENT] id=${result.data?.id} to=${to}`);
  return result;
}

export async function sendReservationConfirmationEmail(to, { drugName, strength, clinicName, clinicAddress, todayHours, qty, reservationId }) {
  const resend = getClient();

  if (!resend) {
    console.log('\n📋 [RESERVATION EMAIL STUB] ─────────────────────────────');
    console.log(`  To:          ${to}`);
    console.log(`  Drug:        ${drugName} ${strength} × ${qty}`);
    console.log(`  Clinic:      ${clinicName} — ${clinicAddress}`);
    console.log(`  Reservation: #${reservationId}`);
    console.log('────────────────────────────────────────────\n');
    return { stub: true };
  }

  const result = await resend.emails.send({
    from: 'MedBridge <onboarding@resend.dev>',
    to,
    subject: `Reservation confirmed — pick up your ${drugName} within 48 hrs`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0e1a;color:#e2e8f0;padding:32px;border-radius:12px;">
        <div style="color:#00d4aa;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px;">MedBridge · Reservation Confirmed</div>
        <h1 style="font-size:22px;margin:0 0 8px;color:#fff;">Your reservation is confirmed!</h1>
        <p style="color:#94a3b8;margin:0 0 24px;"><strong style="color:#fff;">${qty} units of ${drugName} ${strength}</strong> are being held for you. Bring your prescription and photo ID to pick them up — 100% free.</p>

        <div style="background:#111827;border:1px solid #1e2d45;border-radius:10px;padding:20px;margin-bottom:20px;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Pick-Up Clinic</div>
          <div style="font-size:16px;font-weight:600;color:#fff;">${clinicName}</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:2px;">${clinicAddress}</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:2px;">Today: ${todayHours}</div>
        </div>

        <div style="background:#f59e0b15;border:1px solid #f59e0b40;border-radius:10px;padding:16px;margin-bottom:24px;font-size:13px;color:#e2e8f0;">
          Reservation ID: <strong style="font-family:monospace;color:#f59e0b;">#${reservationId}</strong><br/>
          <strong style="color:#f59e0b;">You have 48 hours</strong> to pick this up before the reservation expires.
        </div>

        <p style="font-size:11px;color:#475569;text-align:center;margin:0;">
          MedBridge · Colorado Free Medication Network<br/>
          This is a one-time confirmation. No further action needed until pick-up.
        </p>
      </div>
    `,
  });

  if (result.error) throw new Error(result.error.message);
  console.log(`📋 [RESERVATION EMAIL SENT] id=${result.data?.id} to=${to}`);
  return result;
}

export async function sendGratitudeEmail(to, { drugName, strength, message }) {
  const resend = getClient();

  if (!resend) {
    console.log('\n💚 [GRATITUDE STUB] ─────────────────────────────');
    console.log(`  To:      ${to}`);
    console.log(`  Drug:    ${drugName} ${strength}`);
    console.log(`  Message: ${message}`);
    console.log('────────────────────────────────────────────\n');
    return { stub: true };
  }

  const result = await resend.emails.send({
    from: 'MedBridge <onboarding@resend.dev>',
    to,
    subject: `A patient is grateful for your ${drugName} donation`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0e1a;color:#e2e8f0;padding:32px;border-radius:12px;">
        <div style="color:#10b981;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px;">MedBridge · Anonymous Thank-You</div>
        <h1 style="font-size:22px;margin:0 0 16px;color:#fff;">Your donation made a difference.</h1>
        <p style="color:#94a3b8;margin:0 0 24px;">Someone in Colorado received your donated <strong style="color:#fff;">${drugName} ${strength}</strong> and wanted you to know:</p>
        <div style="background:#111827;border:1px solid #10b981;border-radius:10px;padding:20px;margin-bottom:24px;">
          <p style="font-size:15px;color:#e2e8f0;margin:0;font-style:italic;">"${message}"</p>
        </div>
        <p style="font-size:12px;color:#475569;text-align:center;margin:0;">
          This message was sent anonymously through MedBridge.<br/>No patient identifying information was shared.
        </p>
      </div>
    `,
  });

  if (result.error) throw new Error(result.error.message);
  return result;
}
