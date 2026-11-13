import { useState } from 'react';
import { Crest, Stars } from '../../components/Chara';
import { BottomNav } from '../../components/Shell/BottomNav';
import { Avatar } from '../../components/Shell/CharaCard';
import { TopBar } from '../../components/Shell/TopBar';
import { behindText } from '../../components/Shell/bits';
import type { Screen } from '../../components/Shell/actions';
import { charaInfo } from '../../components/Shell/chara';
import { fieldSlotOrder, layoutField } from '../../game/data/formations';
import { SCOUT_POOL, splitCharId, withPlus } from '../../game/data/roster';
import type { FieldPosition } from '../../game/types';
import { formationCounts, levelOf, lineupOf, setFieldSlot, setKeeper, teamPower, type SaveData } from '../../meta/save';
import { nextStage, stageLineup } from '../../meta/stages';
import { saveStore } from '../../meta/store';
import '../../components/Shell/Shell.css';
import './Team.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  /** A player carried over from the box (「編成に入れる」): the next slot tapped takes him. */
  holding: string | null;
  onHoldDone: () => void;
  /** DEV QA: `0..4` or `gk` selects that slot. */
  qa?: string;
}

type Sel = number | 'gk' | null;
type PosFilter = 'all' | FieldPosition;
const POS_FILTERS: PosFilter[] = ['all', 'DF', 'MF', 'FW'];

/** Pitch rows are drawn between the half-way line (y = 5) and the goal; y -> top %. */
const rowTop = (y: number): number => Math.min(78, Math.max(14, 6 + (y - 5) * 20));
const COLS = 7;
const GK_TOP = 86;

const parseQa = (qa?: string): Sel => (qa === 'gk' ? 'gk' : qa !== undefined && /^[0-4]$/.test(qa) ? Number(qa) : null);

export function TeamScreen({ save, onNav, holding, onHoldDone, qa }: Props) {
  const [sel, setSel] = useState<Sel>(parseQa(qa));
  const [posFilter, setPosFilter] = useState<PosFilter>('all');
  const lineup = lineupOf(save);
  const myPower = teamPower(lineup);
  const next = nextStage(save);
  const rival = stageLineup(next);
  const rivalPower = teamPower(rival);
  const ahead = myPower >= rivalPower;
  const counts = formationCounts(lineup);

  // Cells from the engine's layout (never copied here). Slots are drawn by the player's own order (save.lineup.field).
  const order = fieldSlotOrder(save.lineup.field);
  const cells = layoutField(order);
  const cellOf = (id: string) => cells[order.indexOf(id)];

  const warn =
    counts.DF === 0
      ? 'DF がいません。守りが薄くなります'
      : counts.FW === 0
        ? 'FW がいません。キックオフは MF（いなければ DF）が蹴ります'
        : null;

  const held = holding ? charaInfo(holding) : null;
  const tapField = (i: number) => {
    if (holding) {
      saveStore.update((s) => setFieldSlot(s, i as 0 | 1 | 2 | 3 | 4, holding));
      onHoldDone();
      setSel(null);
      return;
    }
    setSel(sel === i ? null : i);
  };

  const ownedPool = SCOUT_POOL.filter((p) => (save.owned[p.id] ?? 0) > 0);
  const options =
    sel === 'gk'
      ? ownedPool.filter((p) => p.position === 'GK')
      : typeof sel === 'number'
        ? ownedPool.filter((p) => p.position !== 'GK' && (posFilter === 'all' || p.position === posFilter))
        : [];
  options.sort((a, b) => b.rarity - a.rarity);

  const pick = (id: string) => {
    if (sel === 'gk') saveStore.update((s) => setKeeper(s, id));
    else if (typeof sel === 'number') saveStore.update((s) => setFieldSlot(s, sel as 0 | 1 | 2 | 3 | 4, id));
  };
  const inLineup = (id: string): boolean => save.lineup.field.includes(id) || save.lineup.gk === id;

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
        <div className="team__formation" data-testid="team-formation">
          <b className="a-num">DF {counts.DF}・MF {counts.MF}・FW {counts.FW}</b>
          {warn && <span className="team__warn" data-testid="team-formation-warn">{warn}</span>}
        </div>
        <div className="team__pitch">
          <div className="team__line team__line--mid" />
          <div className="team__circle" />
          <div className="team__box" />
          {save.lineup.field.map((id, i) => {
            const c = cellOf(id);
            const { def } = charaInfo(id);
            return (
              <button
                key={i}
                type="button"
                className={`team__slot${sel === i ? ' is-on' : ''}${holding ? ' is-target' : ''}`}
                style={{ left: `${((c.x + 0.5) / COLS) * 100}%`, top: `${rowTop(c.y)}%` }}
                onClick={() => tapField(i)}
                data-testid={`team-slot-${i}`}
                aria-label={`${def.position} ${def.name}`}
              >
                <span className="team__medal"><Avatar id={withPlus(id, levelOf(save, id) - 1)} tag={`Lv.${levelOf(save, id)}`} /></span>
              </button>
            );
          })}
          <button
            type="button"
            className={`team__slot team__slot--gk${sel === 'gk' ? ' is-on' : ''}`}
            style={{ left: '50%', top: `${GK_TOP}%` }}
            onClick={() => {
              onHoldDone();
              setSel(sel === 'gk' ? null : 'gk');
            }}
            data-testid="team-slot-gk"
            aria-label={`GK ${charaInfo(save.lineup.gk).def.name}`}
          >
            <span className="team__medal"><Avatar id={withPlus(save.lineup.gk, levelOf(save, save.lineup.gk) - 1)} tag={`Lv.${levelOf(save, save.lineup.gk)}`} /></span>
          </button>
        </div>
        <div className="team__pick a-panel" data-testid="team-pick">
          {holding && held ? (
            <div className="team__hold">
              <span className="team__holdface"><Avatar id={holding} /></span>
              <span className="team__holdtxt">
                <b>{held.def.name}</b>
                <span>入れ替える枠を選んでください</span>
              </span>
              <button type="button" className="a-btn a-btn--dark a-btn--sm" onClick={onHoldDone}><span>やめる</span></button>
            </div>
          ) : sel !== null ? (
            <>
              <div className="team__picklabel">
                <span className="a-tag">{sel === 'gk' ? 'GK' : '選手'}</span>
                <span>{sel === 'gk' ? 'ゴールキーパーを選ぶ' : '入れ替える選手を選ぶ'}</span>
                {sel !== 'gk' && (
                  <span className="team__posfilter">
                    {POS_FILTERS.map((f) => (
                      <button key={f} type="button" className={posFilter === f ? 'is-on' : ''} onClick={() => setPosFilter(f)} data-testid={`team-pickpos-${f}`}>
                        {f === 'all' ? '全員' : f}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              <div className="team__picklist">
                {options.map((p) => {
                  const lv = levelOf(save, p.id);
                  const on = inLineup(p.id);
                  return (
                    <button key={p.id} type="button" className={`team__opt team__opt--r${p.rarity}${on ? ' is-on' : ''}`} onClick={() => pick(p.id)} data-testid={`team-pick-${p.id}`}>
                      {on && <span className="team__optnow a-tag a-tag--blue">編成中</span>}
                      <span className="team__optface"><Avatar id={p.id} tag={`Lv.${lv}`} /></span>
                      <span className="team__optname">{p.name}</span>
                      <Stars rarity={p.rarity} size={10} />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="team__pickempty">スロットをタップして選手を入れ替えます。DF・MF・FW の人数は自由です。</p>
              <div className="team__strip">
                {[...order, lineup.gk].map((id, i) => (
                  <span key={id + i} className="team__chipface">
                    <Avatar id={id} tag={`Lv.${levelOf(save, splitCharId(id).base)}`} />
                  </span>
                ))}
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
            {[...fieldSlotOrder(rival.field), rival.gk].map((id) => (
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
