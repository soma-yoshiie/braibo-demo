import { useState } from 'react';
import { BottomNav } from '../../components/Shell/BottomNav';
import { behindText } from '../../components/Shell/bits';
import { Avatar } from '../../components/Shell/CharaCard';
import { Stars } from '../../components/Chara';
import { TopBar } from '../../components/Shell/TopBar';
import type { Screen } from '../../components/Shell/actions';
import { STAT_LABEL, charaInfo } from '../../components/Shell/chara';
import { Crest } from '../../components/Chara';
import { DEFAULT_FORMATION } from '../../game/data/formations';
import { ROLE_ORDER, SCOUT_POOL, splitCharId, withPlus } from '../../game/data/roster';
import { ROLE_LABEL, getCharacter } from '../../game/data/characters';
import { levelOf, lineupIds, setLineup, teamPower, type SaveData } from '../../meta/save';
import { nextStage, stageLineup } from '../../meta/stages';
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
  const ids = lineupIds(save);
  const myPower = teamPower(ids);
  const next = nextStage(save);
  const rivals = stageLineup(next);
  const rivalPower = teamPower(rivals);
  const ahead = myPower >= rivalPower;
  const options = role
    ? SCOUT_POOL.filter((p) => p.role === role && (save.owned[p.id] ?? 0) > 0).sort((a, b) => b.rarity - a.rarity)
    : [];
  return (
    <div className="scr team" data-testid="team-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar title="編成" save={save} />
      <div className="scr__main team__main">
        <div className="team__power a-panel" data-testid="team-power-box">
          <Crest team="blue" size={22} />
          <span className="a-head a-head--md">蒼嵐</span>
          <span className="team__powerlbl">総合力</span>
          <b className={`a-num team__powernum ${ahead ? 'is-ahead' : 'is-behind'}`} data-testid="team-power">{myPower}</b>
          <span className="team__vs">
            <span>STAGE {next.no} 相手</span>
            <b className="a-num" data-testid="team-rival-power">{rivalPower}</b>
            {behindText(myPower, rivalPower) && <em className="team__behind">{behindText(myPower, rivalPower)}</em>}
          </span>
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
                <span className="team__medal"><Avatar id={ids[ROLE_ORDER.indexOf(r)]} tag={`Lv.${levelOf(save, id)}`} /></span>
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
                  const lv = levelOf(save, p.id);
                  const def = getCharacter(withPlus(p.id, lv - 1));
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
                      <span className="team__optface"><Avatar id={p.id} tag={`Lv.${lv}`} /></span>
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
                      <span className="team__chipface"><Avatar id={id} tag={`Lv.${levelOf(save, id)}`} /></span>
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
            <span className="team__hint">STAGE {next.no} {next.name}</span>
          </div>
          <div className="team__rivalrow">
            {rivals.map((id) => (
              <div key={id} className="team__rv">
                <span className="team__rvmedal"><Avatar id={id} tag={splitCharId(id).plus ? `+${splitCharId(id).plus}` : undefined} /></span>
                <span className="team__rvname">{charaInfo(id).def.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav current="team" onNav={onNav} save={save} />
    </div>
  );
}
