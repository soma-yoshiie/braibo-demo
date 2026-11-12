import { useState } from 'react';
import { BottomNav } from '../../components/Shell/BottomNav';
import { Avatar } from '../../components/Shell/CharaCard';
import { Stars } from '../../components/Chara';
import { TopBar } from '../../components/Shell/TopBar';
import type { Screen } from '../../components/Shell/actions';
import { STAT_LABEL, charaInfo } from '../../components/Shell/chara';
import { Crest } from '../../components/Chara';
import { DEFAULT_FORMATION } from '../../game/data/formations';
import { ROLE_ORDER, RIVAL_LINEUP, SCOUT_POOL } from '../../game/data/roster';
import { ROLE_LABEL } from '../../game/data/characters';
import { setLineup, type SaveData } from '../../meta/save';
import { saveStore } from '../../meta/store';
import type { RoleId } from '../../game/types';
import '../../components/Shell/Shell.css';
import './Team.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  qa?: string;
}

/** 表示する盤面の行（0 が相手ゴール側）。自陣の半分だけ見せる。 */
const ROW0 = 4;
const ROWS = 6;
const COLS = 7;

export function TeamScreen({ save, onNav, qa }: Props) {
  const [role, setRole] = useState<RoleId | null>(ROLE_ORDER.find((r) => r === qa) ?? null);
  const options = role
    ? SCOUT_POOL.filter((p) => p.role === role && (save.owned[p.id] ?? 0) > 0).sort((a, b) => b.rarity - a.rarity)
    : [];
  return (
    <div className="scr team" data-testid="team-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar title="編成" sub="LINE-UP" coins={save.coins} />
      <div className="scr__main team__main">
        <div className="team__label">
          <Crest team="blue" size={22} />
          <span className="a-head a-head--md">蒼嵐</span>
          <span className="team__hint">スロットをタップして選手を変更</span>
        </div>
        <div className="team__pitch">
          <div className="team__line team__line--mid" />
          <div className="team__circle" />
          <div className="team__box" />
          {DEFAULT_FORMATION.map((slot) => {
            const r = ROLE_ORDER.find((x) => x === slot.charId);
            if (!r) return null;
            const id = save.lineup[r];
            const { def } = charaInfo(id);
            return (
              <button
                key={r}
                type="button"
                className={`team__slot${role === r ? ' is-on' : ''}`}
                style={{ left: `${((slot.pos.x + 0.5) / COLS) * 100}%`, top: `${((slot.pos.y - ROW0 + 0.5) / ROWS) * 100}%` }}
                onClick={() => setRole(role === r ? null : r)}
                data-testid={`team-slot-${r}`}
                aria-label={`${ROLE_LABEL[r]} ${def.name}`}
              >
                <span className="team__medal"><Avatar id={id} /></span>
                <span className="team__sname">{def.name}</span>
              </button>
            );
          })}
        </div>
        <div className="team__pick a-panel" data-testid="team-pick">
          {role ? (
            <>
              <div className="team__picklabel"><span className="a-tag">{ROLE_LABEL[role]}</span> を選ぶ</div>
              <div className="team__picklist">
                {options.map((p) => {
                  const { def } = charaInfo(p.id);
                  const top = (Object.keys(def.stats) as (keyof typeof def.stats)[]).sort((x, y) => def.stats[y] - def.stats[x]).slice(0, 2);
                  const on = save.lineup[role] === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`team__opt team__opt--r${p.rarity}${on ? ' is-on' : ''}`}
                      onClick={() => saveStore.update((s) => setLineup(s, role, p.id))}
                      data-testid={`team-pick-${p.id}`}
                    >
                      {on && <span className="team__optnow a-tag a-tag--blue">編成中</span>}
                      <span className="team__optface"><Avatar id={p.id} /></span>
                      <span className="team__optname">{def.name}</span>
                      <Stars rarity={p.rarity} size={12} />
                      <span className="team__optstats">
                        {top.map((k) => (
                          <span key={k}>{STAT_LABEL[k]} <b className="a-num">{def.stats[k]}</b></span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="team__pickempty">ロールごとに 1 人ずつ。スロットをタップして、持っている選手から選べます。</p>
              <div className="team__strip">
                {ROLE_ORDER.map((r) => {
                  const id = save.lineup[r];
                  return (
                    <button key={r} type="button" className="team__chip" onClick={() => setRole(r)} aria-label={charaInfo(id).def.name}>
                      <span className="team__chipface"><Avatar id={id} /></span>
                      <span className="a-num team__chiprole">{charaInfo(id).abbr}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="team__rival" data-testid="team-rival">
          <div className="team__rivalhead">
            <Crest team="red" size={20} />
            <span className="a-head a-head--sm">紅蓮</span>
            <span className="team__hint">対戦相手</span>
          </div>
          <div className="team__rivalrow">
            {RIVAL_LINEUP.map((id) => (
              <div key={id} className="team__rv">
                <span className="team__rvmedal"><Avatar id={id} /></span>
                <span className="team__rvname">{charaInfo(id).def.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav current="team" onNav={onNav} />
    </div>
  );
}
