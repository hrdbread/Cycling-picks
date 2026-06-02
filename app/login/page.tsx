import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getPlayers } from '@/lib/queries';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const session = await getSession();
  if (session.playerId) redirect('/');
  const players = getPlayers();
  return (
    <div className="space-y-8">
      <div className="pkm-frame--inverted pkm-frame">
        <div className="font-arcade text-lg sm:text-2xl pkm-arrow">SELECT TRAINER</div>
        <p className="text-[11px] mt-3 leading-relaxed">
          Pick your fighter. Type your password. Hit START.
        </p>
      </div>
      <LoginForm players={players.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}
