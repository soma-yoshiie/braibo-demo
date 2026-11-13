import { useMemo, useState } from 'react';
import { BottomNav } from '../../components/Shell/BottomNav';
import { CharaTile } from '../../components/Shell/CharaCard';
import { CharaDetail } from '../../components/Shell/CharaDetail';
import { TopBar } from '../../components/Shell/TopBar';
import type { Screen } from '../../components/Shell/actions';
import { ROLE_FILTERS } from '../../components/Shell/chara';
import { ROLE_ORDER, SCOUT_POOL } from '../../game/data/roster';
import { levelOf, levelUp, setLineup, type SaveData } from '../../meta/save';
import { saveStore } from '../../meta/store';
import '../../components/Shell/Shell.css';
import './Box.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  qa?: string;
}

type Filter = (typeof ROLE_FILTERS)[number]['key'];
type Sort = 'rarity' | 'level' | 'role';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'rarity', label: '★順' },
  { key: 'level', label: 'Lv順' },
  { key: 'role', label: 'ロール順' },
];

export function BoxScreen({ save, onNav, qa }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('rarity');
  const [detail, setDetail] = useState<string | null>(qa && SCOUT_POOL.some((p) => p.id === qa && (save.owned[p.id] ?? 0) > 0) ? qa : null);
  const list = useMemo(() => {
    const has = (id: string): number => ((save.owned[id] ?? 0) > 0 ? 1 : 0);
    const roleIdx = (r: string): number => ROLE_ORDER.findIndex((x) => x === r);
    return SCOUT_POOL.filter((p) => filter === 'all' || p.role === filter).sort((a, b) => {
      if (has(a.id) !== has(b.id)) return has(b.id) - has(a.id);
      const byStar = b.rarity - a.rarity;
      const byRole = roleIdx(a.role) - roleIdx(b.role);
      const byLv = levelOf(save, b.id) - levelOf(save, a.id);
      if (sort === 'level') return byLv || byStar || byRole;
      if (sort === 'role') return byRole || byStar;
      return byStar || byRole;
    });
  }, [filter, sort, save]);
  const ownedCount = SCOUT_POOL.filter((p) => (save.owned[p.id] ?? 0) > 0).length;
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? '';
  return (
    <div className="scr box" data-testid="box-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar title="選手" save={save} />
      <div className="scr__main">
        <div className="box__bar">
          <div className="box__filters">
            {ROLE_FILTERS.map((f) => (
              <button key={f.key} type="button" className={`box__chip${filter === f.key ? ' is-on' : ''}`} onClick={() => setFilter(f.key)} data-testid={`box-filter-${f.key}`}>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
          <div className="box__row">
            <div className="box__count" data-testid="box-count">
              所持 <b className="a-num">{ownedCount}</b> / {SCOUT_POOL.length}
            </div>
            <button
              type="button"
              className="a-btn a-btn--dark a-btn--sm box__sort"
              onClick={() => setSort(SORTS[(SORTS.findIndex((s) => s.key === sort) + 1) % SORTS.length].key)}
              data-testid="box-sort"
            >
              <span>並べ替え：{sortLabel}</span>
            </button>
          </div>
        </div>
        <div className="box__grid" data-testid="box-grid">
          {list.map((p) => {
            const n = save.owned[p.id] ?? 0;
            return (
              <CharaTile
                key={p.id}
                id={p.id}
                owned={n > 0}
                level={levelOf(save, p.id)}
                inLineup={save.lineup[p.role] === p.id}
                onClick={n > 0 ? () => setDetail(p.id) : undefined}
                testId={`box-card-${p.id}`}
              />
            );
          })}
        </div>
      </div>
      <BottomNav current="box" onNav={onNav} save={save} />
      {detail && (
        <CharaDetail
          id={detail}
          save={save}
          onClose={() => setDetail(null)}
          onSet={(id) => {
            const role = SCOUT_POOL.find((p) => p.id === id)?.role;
            if (role) saveStore.update((s) => setLineup(s, role, id));
          }}
          onLevelUp={(id) => saveStore.update((s) => levelUp(s, id))}
        />
      )}
    </div>
  );
}
