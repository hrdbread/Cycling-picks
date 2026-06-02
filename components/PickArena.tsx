'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import RiderCard from './RiderCard';
import TeamCard from './TeamCard';

type Rider = {
  id: number;
  pcs_slug?: string;
  name: string;
  country: string | null;
  team_id: number | null;
  photo_url: string | null;
  team_shirt_url: string | null;
};

type Team = {
  id: number;
  pcs_slug?: string | null;
  name: string;
  shirt_url: string | null;
};

type Props = {
  tourSlug: string;
  tourName: string;
  leagueSlug: string;
  leagueName: string;
  riders: Rider[];
  teams: Team[];
  initialRiders: number[];
  initialTeams: number[];
};

const MAX = 3;

export default function PickArena(props: Props) {
  const router = useRouter();
  const [riderPicks, setRiderPicks] = useState<number[]>(props.initialRiders);
  const [teamPicks, setTeamPicks] = useState<number[]>(props.initialTeams);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'riders' | 'teams'>('riders');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamById = useMemo(
    () => new Map(props.teams.map((t) => [t.id, t])),
    [props.teams],
  );
  const riderById = useMemo(
    () => new Map(props.riders.map((r) => [r.id, r])),
    [props.riders],
  );

  const filteredRiders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.riders;
    return props.riders.filter((r) => {
      const t = r.team_id ? teamById.get(r.team_id)?.name ?? '' : '';
      return (
        r.name.toLowerCase().includes(q) ||
        t.toLowerCase().includes(q) ||
        (r.country ?? '').toLowerCase().includes(q)
      );
    });
  }, [search, props.riders, teamById]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.teams;
    return props.teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [search, props.teams]);

  function toggleRider(id: number) {
    setRiderPicks((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX) return cur;
      return [...cur, id];
    });
  }
  function toggleTeam(id: number) {
    setTeamPicks((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX) return cur;
      return [...cur, id];
    });
  }

  const ready = riderPicks.length === MAX && teamPicks.length === MAX;

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        leagueSlug: props.leagueSlug,
        tourSlug: props.tourSlug,
        riderIds: riderPicks,
        teamIds: teamPicks,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Save failed');
      setBusy(false);
      return;
    }
    router.push(`/tour/${props.tourSlug}?league=${props.leagueSlug}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="pkm-frame--inverted pkm-frame">
        <div className="font-arcade text-[10px] uppercase">
          {props.leagueName} · {props.tourName}
        </div>
        <h1 className="font-arcade text-lg sm:text-2xl mt-2 pkm-arrow">
          CHOOSE YOUR RIDERS!
        </h1>
        <p className="text-[11px] mt-2 leading-relaxed">
          Pick 3 GC contenders and 3 teams. Same picks as another player in this
          league cancel out.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <SlotRow
          title="YOUR RIDERS"
          slots={MAX}
          picks={riderPicks
            .map((id) => riderById.get(id))
            .filter((r): r is Rider => Boolean(r))
            .map((r) => ({
              kind: 'rider' as const,
              data: r,
              teamName: r.team_id ? teamById.get(r.team_id)?.name ?? null : null,
            }))}
          onRemove={(id) => toggleRider(id)}
        />
        <SlotRow
          title="YOUR TEAMS"
          slots={MAX}
          picks={teamPicks
            .map((id) => teamById.get(id))
            .filter((t): t is Team => Boolean(t))
            .map((t) => ({ kind: 'team' as const, data: t }))}
          onRemove={(id) => toggleTeam(id)}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          className={`pkm-btn--ghost ${tab === 'riders' ? 'bg-pkm-stroke text-pkm-paper' : ''}`}
          onClick={() => setTab('riders')}
        >
          Riders ({riderPicks.length}/{MAX})
        </button>
        <button
          className={`pkm-btn--ghost ${tab === 'teams' ? 'bg-pkm-stroke text-pkm-paper' : ''}`}
          onClick={() => setTab('teams')}
        >
          Teams ({teamPicks.length}/{MAX})
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH..."
          className="ml-auto bg-pkm-paper border-4 border-pkm-stroke px-3 py-2 text-[10px] font-arcade w-44 placeholder:text-pkm-shadow"
        />
      </div>

      {tab === 'riders' ? (
        filteredRiders.length === 0 ? (
          <EmptyRoster what="riders" tourSlug={props.tourSlug} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredRiders.map((r) => {
              const selected = riderPicks.includes(r.id);
              const team = r.team_id ? teamById.get(r.team_id) : null;
              const disabled = !selected && riderPicks.length >= MAX;
              return (
                <RiderCard
                  key={r.id}
                  rider={{
                    id: r.id,
                    pcs_slug: r.pcs_slug,
                    name: r.name,
                    country: r.country,
                    team_id: r.team_id,
                    team_name: team?.name ?? null,
                    team_slug: team?.pcs_slug ?? null,
                    team_shirt_url: r.team_shirt_url,
                  }}
                  selected={selected}
                  disabled={disabled}
                  size="md"
                  onClick={() => toggleRider(r.id)}
                />
              );
            })}
          </div>
        )
      ) : filteredTeams.length === 0 ? (
        <EmptyRoster what="teams" tourSlug={props.tourSlug} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredTeams.map((t) => {
            const selected = teamPicks.includes(t.id);
            const disabled = !selected && teamPicks.length >= MAX;
            return (
              <TeamCard
                key={t.id}
                team={{
                  id: t.id,
                  name: t.name,
                  pcs_slug: t.pcs_slug ?? null,
                  shirt_url: t.shirt_url,
                }}
                selected={selected}
                disabled={disabled}
                onClick={() => toggleTeam(t.id)}
              />
            );
          })}
        </div>
      )}

      {error && (
        <div className="pkm-frame">
          <span className="font-arcade text-[10px]">! {error}</span>
        </div>
      )}
      <div className="sticky bottom-4 flex justify-end">
        <button
          className="pkm-btn"
          disabled={!ready || busy}
          onClick={submit}
        >
          {busy ? 'SAVING…' : ready ? 'LOCK IT IN ▶' : `PICK ${MAX}+${MAX}`}
        </button>
      </div>
    </div>
  );
}

function SlotRow({
  title,
  slots,
  picks,
  onRemove,
}: {
  title: string;
  slots: number;
  picks: Array<
    | { kind: 'rider'; data: Rider; teamName: string | null }
    | { kind: 'team'; data: Team }
  >;
  onRemove: (id: number) => void;
}) {
  return (
    <div>
      <div className="font-arcade text-[10px] uppercase tracking-widest mb-2">
        {title}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: slots }).map((_, i) => {
          const p = picks[i];
          if (!p) {
            return (
              <div
                key={i}
                className="aspect-[3/4] border-4 border-dashed border-pkm-stroke flex items-center justify-center"
              >
                <span className="font-arcade text-[8px] text-pkm-shadow">
                  EMPTY
                </span>
              </div>
            );
          }
          if (p.kind === 'rider') {
            return (
              <RiderCard
                key={p.data.id}
                rider={{
                  id: p.data.id,
                  pcs_slug: p.data.pcs_slug,
                  name: p.data.name,
                  country: p.data.country,
                  team_id: p.data.team_id,
                  team_name: p.teamName,
                  team_shirt_url: p.data.team_shirt_url,
                }}
                size="sm"
                onClick={() => onRemove(p.data.id)}
              />
            );
          }
          return (
            <TeamCard
              key={p.data.id}
              team={{
                id: p.data.id,
                name: p.data.name,
                pcs_slug: p.data.pcs_slug ?? null,
                shirt_url: p.data.shirt_url,
              }}
              size="sm"
              onClick={() => onRemove(p.data.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function EmptyRoster({
  what,
  tourSlug,
}: {
  what: 'riders' | 'teams';
  tourSlug: string;
}) {
  return (
    <div className="pkm-frame text-[10px] font-arcade">
      NO {what.toUpperCase()} LOADED. RUN&nbsp;
      <code>npm run sync:startlist -- {tourSlug}</code>
    </div>
  );
}
