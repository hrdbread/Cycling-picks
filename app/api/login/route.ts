import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/session';
import { getPlayer } from '@/lib/queries';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { playerId?: number; password?: string }
    | null;
  if (!body || typeof body.playerId !== 'number' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const player = getPlayer(body.playerId);
  if (!player) {
    return NextResponse.json({ error: 'Unknown player' }, { status: 404 });
  }
  const ok = bcrypt.compareSync(body.password, player.pin_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const session = await getSession();
  session.playerId = player.id;
  session.playerName = player.name;
  await session.save();
  return NextResponse.json({ ok: true });
}
