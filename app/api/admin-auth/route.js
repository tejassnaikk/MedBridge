import { NextResponse } from 'next/server';

const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'medbridge2024';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}
