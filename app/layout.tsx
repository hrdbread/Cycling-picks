import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import PixelAvatar from '@/components/PixelAvatar';
import { getSession } from '@/lib/session';
import { getPlayer } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Cycling Picks',
  description: 'Grand Tour fantasy bets — Haribo Cup & Fika League',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const player = session.playerId ? getPlayer(session.playerId) : null;
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 bg-pkm-paper border-b-4 border-pkm-stroke">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link
              href="/"
              className="font-arcade text-xs sm:text-sm uppercase tracking-widest"
            >
              CYCLING PICKS
            </Link>
            <nav className="flex items-center gap-3 text-[10px]">
              {player ? (
                <>
                  <span className="flex items-center gap-2">
                    <PixelAvatar
                      keyId={`player-${player.name.toLowerCase()}`}
                      size={5}
                      px={5}
                      bordered
                    />
                    <span className="font-arcade uppercase">{player.name}</span>
                  </span>
                  <form action="/api/logout" method="POST">
                    <button className="pkm-btn--ghost" type="submit">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="pkm-btn--ghost">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
