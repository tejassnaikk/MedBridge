import twilio from 'twilio';

let twilioClient = null;

function getClient() {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  twilioClient = twilio(sid, token);
  return twilioClient;
}

export async function sendSMS(to, message) {
  const client = getClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !from) {
    console.log('\n📱 [SMS STUB] ─────────────────────────────');
    console.log(`  To:  ${to}`);
    console.log(`  Msg: ${message}`);
    console.log('────────────────────────────────────────────\n');
    return { stub: true };
  }

  try {
    const result = await client.messages.create({ to, from, body: message });
    console.log(`📱 [SMS SENT] sid=${result.sid} to=${to}`);
    return result;
  } catch (err) {
    console.error(`📱 [SMS ERROR] to=${to} — ${err.message}`);
    throw err;
  }
}
