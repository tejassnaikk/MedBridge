// SMS via Twilio — gracefully stubs to console if credentials not set

let twilioClient = null;

function getClient() {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  const twilio = require('twilio');
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

  return client.messages.create({ to, from, body: message });
}
