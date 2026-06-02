'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PixelAvatar from '@/components/PixelAvatar';

type PlayerOption = { id: number; name: string };

export default function LoginForm({ players }: { players: PlayerOption[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected == null) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: selected, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Login failed');
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {players.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`pkm-frame text-center ${
              selected === p.id ? 'pkm-frame--inverted translate-x-[-2px] translate-y-[-2px]' : ''
            }`}
          >
            <div className="flex items-center justify-center mb-2">
              <PixelAvatar
                keyId={`player-${p.name.toLowerCase()}`}
                size={6}
                px={8}
                bordered
              />
            </div>
            <div className="font-arcade text-[10px] tracking-widest">
              {p.name.toUpperCase()}
            </div>
          </button>
        ))}
      </div>
      <div className="pkm-frame max-w-sm">
        <label className="block font-arcade text-[10px] uppercase mb-2">
          PASSWORD
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-pkm-paper border-4 border-pkm-stroke px-3 py-2 font-arcade text-sm tracking-[0.15em]"
          placeholder="••••••••"
        />
      </div>
      {error && (
        <div className="pkm-frame inline-block">
          <span className="font-arcade text-[10px]">! {error}</span>
        </div>
      )}
      <div>
        <button
          type="submit"
          disabled={busy || selected == null || password.length === 0}
          className="pkm-btn"
        >
          {busy ? 'LOADING…' : 'START ▶'}
        </button>
      </div>
    </form>
  );
}
