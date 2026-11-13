import { useMemo, useState } from 'react';
import { TypeMark } from '../../components/Chara';
import { BottomNav } from '../../components/Shell/BottomNav';
import { CharaTile } from '../../components/Shell/CharaCard';
import { CharaDetail } from '../../components/Shell/CharaDetail';
import { TopBar } from '../../components/Shell/TopBar';
import type { Screen } from '../../components/Shell/actions';
import { POSITION_ORDER, TYPE_LABEL, TYPE_ORDER } from '../../game/data/positions';
import { SCOUT_POOL } from '../../game/data/roster';
import type { Position, TypeId } from '../../game/types';
import { levelOf, levelUp, setKeeper, type SaveData } from '../../meta/save';
import { saveStore } from '../../meta/store';
import '../../components/Shell/Shell.css';
import './Box.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  /** 「編成に入れる」: the team screen opens holding this player. */
  onToTeam: (charId: string) => void;
  qa?: string;
}

type Sort = 'rarity' | 'level' | 'type' | 'position';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'rarity', label: '★順' },
  { key: 'level', label: 'Lv順' },
  { key: 'type', label: 'タイプ順' },
  { key: 'position', label: 'ポジション順' },
];

export function BoxScreen({ save, onNav, onToTeam, qa }: Props) {
  const [type, setType] = useState<TypeId | 'all'>('all');
  const [pos, setPos] = useState<Position | null>(null);
  const [sort, setSort] = useState<Sort>('rarity');
  const [detail, setDetail] = useState<string | null>(qa && SCOUT_POOL.some((p) => p.id === qa && (save.owned[p.id] ?? 0) > 0) ? qa : null);
  const list = useMemo(() => {
    const has = (id: string): number => ((save.owned[id] ?? 0) > 0 ? 1 : 0);
    return SCOUT_POOL.filter((p) => (type === 'all' || p.type === type) && (pos === null || p.position === pos)).sort((a, b) => {
      if (has(a.id) !== has(b.id)) return has(b.id) - has(a.id);
      const byStar = b.rarity - a.rarity;
      const byType = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      const byPos = POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);
      const byLv = levelOf(save, b.id) - levelOf(save, a.id);
      if (sort === 'level') return byLv || byStar || byType || byPos;
      if (sort === 'type') return byType || byStar || byPos;
      if (sort === 'position') return byPos || byStar || byType;
      return byStar || byType || byPos;
    });
  }, [type, pos, sort, save]);
  const ownedCount = SCOUT_POOL.filter((p) => (save.owned[p.id] ?? 0) > 0).length;
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? '';
  return (
    <div className="scr box" data-testid="box-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar title="選手" save={save} />
      <div className="scr__main">
        <div className="box__bar">
          <div className="box__filters">
            <button type="button" className={`box__chip${type === 'all' ? ' is-on' : ''}`} onClick={() => setType('all')} data-testid="box-filter-all">
              <span>全員</span>
            </button>
            {TYPE_ORDER.map((t) => (
              <button key={t} type="button" className={`box__chip${type === t ? ' is-on' : ''}`} onClick={() => setType(t)} data-testid={`box-type-${t}`} aria-label={TYPE_LABEL[t]} title={TYPE_LABEL[t]}>
                <span><TypeMark type={t} size={26} /></span>
              </button>
            ))}
          </div>
          <div className="box__filters box__filters--pos">
            {POSITION_ORDER.map((p) => (
              <button key={p} type="button" className={`box__chip${pos === p ? ' is-on' : ''}`} onClick={() => setPos(pos === p ? null : p)} data-testid={`box-pos-${p}`} aria-pressed={pos === p}>
                <span className="a-num">{p}</span>
              </button>
            ))}
          </div>
          <div className="box__row">
            <div className="box__count" data-testid="box-count">
              所持 <b className="a-num">{ownedCount}</b> / {SCOUT_POOL.length}
              {type !== 'all' && <span className="box__typename">{TYPE_LABEL[type]}</span>}
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
          {list.length === 0 && <p className="box__empty" data-testid="box-empty">この条件の選手はいません</p>}
          {list.map((p) => {
            const n = save.owned[p.id] ?? 0;
            const inLineup = p.position === 'GK' ? save.lineup.gk === p.id : save.lineup.field.includes(p.id);
            return (
              <CharaTile
                key={p.id}
                id={p.id}
                owned={n > 0}
                level={levelOf(save, p.id)}
                inLineup={inLineup}
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
            const p = SCOUT_POOL.find((x) => x.id === id);
            if (!p) return;
            if (p.position === 'GK') saveStore.update((s) => setKeeper(s, id));
            else onToTeam(id);
          }}
          onLevelUp={(id) => saveStore.update((s) => levelUp(s, id))}
        />
      )}
    </div>
  );
}
