import { useMemo, useState } from 'react';
import { BottomNav } from '../../components/Shell/BottomNav';
import { CharaCard } from '../../components/Shell/CharaCard';
import { CharaDetail } from '../../components/Shell/CharaDetail';
import { TopBar } from '../../components/Shell/TopBar';
import type { Screen } from '../../components/Shell/actions';
import { ROLE_FILTERS } from '../../components/Shell/chara';
import { ROLE_ORDER, SCOUT_POOL } from '../../game/data/roster';
import { setLineup, type SaveData } from '../../meta/save';
import { saveStore } from '../../meta/store';
import '../../components/Shell/Shell.css';
import './Box.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  qa?: string;
}

type Filter = (typeof ROLE_FILTERS)[number]['key'];

export function BoxScreen({ save, onNav, qa }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [detail, setDetail] = useState<string | null>(qa && SCOUT_POOL.some((p) => p.id === qa && (save.owned[p.id] ?? 0) > 0) ? qa : null);
  const list = useMemo(() => {
    const has = (id: string): number => ((save.owned[id] ?? 0) > 0 ? 1 : 0);
    return SCOUT_POOL.filter((p) => filter === 'all' || p.role === filter).sort(
      (a, b) => has(b.id) - has(a.id) || b.rarity - a.rarity || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
    );
  }, [filter, save.owned]);
  const ownedCount = SCOUT_POOL.filter((p) => (save.owned[p.id] ?? 0) > 0).length;
  return (
    <div className="scr box" data-testid="box-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar title="選手" sub="CHARACTERS" coins={save.coins} />
      <div className="scr__main">
        <div className="box__bar">
          <div className="box__filters">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`box__chip${filter === f.key ? ' is-on' : ''}`}
                onClick={() => setFilter(f.key)}
                data-testid={`box-filter-${f.key}`}
              >
                <span>{f.label}</span>
              </button>
            ))}
          </div>
          <div className="box__count" data-testid="box-count">
            所持 <b className="a-num">{ownedCount}</b> / {SCOUT_POOL.length}
          </div>
        </div>
        <div className="box__grid" data-testid="box-grid">
          {list.map((p) => {
            const n = save.owned[p.id] ?? 0;
            return (
              <CharaCard
                key={p.id}
                id={p.id}
                owned={n > 0}
                dup={Math.max(0, n - 1)}
                selected={save.lineup[p.role] === p.id}
                badge={save.lineup[p.role] === p.id ? '編成中' : undefined}
                onClick={n > 0 ? () => setDetail(p.id) : undefined}
                testId={`box-card-${p.id}`}
              />
            );
          })}
        </div>
      </div>
      <BottomNav current="box" onNav={onNav} />
      {detail && (
        <CharaDetail
          id={detail}
          save={save}
          onClose={() => setDetail(null)}
          onSet={(id) => {
            const role = SCOUT_POOL.find((p) => p.id === id)?.role;
            if (role) saveStore.update((s) => setLineup(s, role, id));
          }}
        />
      )}
    </div>
  );
}
