import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export type SessionData = {
  playerId?: number;
  playerName?: string;
};

const NINETY_DAYS = 60 * 60 * 24 * 90;

const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    'dev-only-insecure-secret-please-replace-me-32+chars',
  cookieName: 'cycling_picks_session',
  ttl: NINETY_DAYS,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: NINETY_DAYS,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
