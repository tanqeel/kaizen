import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const secret = req.headers.get('x-cleanup-secret');
  return NextResponse.json({ 
    received: secret ? secret.substring(0, 10) + '...' : null,
    length: secret?.length || 0,
    expected_start: '4b909aa984',
  });
}
