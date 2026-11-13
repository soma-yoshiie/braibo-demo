import { useEffect, useRef, useState } from 'react';
import { CharaBust, PosTag, SpeedLines, Stars, TypeChip } from '../Chara';
import { getCharacter } from '../../game/data/characters';
import { POSITION_MOD } from '../../game/data/positions';
import { withPlus } from '../../game/data/roster';
import { META } from '../../meta/config';
import { levelOf, levelUpCost, type SaveData } from '../../meta/save';
import { MoveDiagram } from './MoveDiagram';
import { Sheet } from './Sheet';
import { StatBars } from './StatBars';
import { SKILL_LABEL, STAT_LABEL, charaInfo } from './chara';
import './Shell.css';

interface Props {
  id: string;
  save: SaveData;
  onClose: () => void;
  /** GK: sets the keeper right away. Field player: goes to the team screen holding this player. */
  onSet: (id: string) => void;
  onLevelUp: (id: string) => void;
}

export function CharaDetail({ id, save, onClose, onSet, onLevelUp }: Props) {
  const { profile, def: baseDef, team, keeper } = charaInfo(id);
  const lv = levelOf(save, id);
  const def = getCharacter(withPlus(id, lv - 1)); // stats with the level applied
  const power = Object.values(def.stats).reduce((a, b) => a + b, 0);
  const cost = levelUpCost(save, id);
  const max = lv >= META.level.max;
  const can = cost !== null && save.coins >= cost;
  const inLineup = keeper ? save.lineup.gk === id : save.lineup.field.includes(id);
  const mod = !keeper && profile.position !== 'GK' ? POSITION_MOD[profile.position] : null;
  const modKeys = mod ? (Object.keys(mod) as (keyof typeof mod)[]) : [];
  const modUp = modKeys.filter((k) => (mod?.[k] ?? 0) > 0).map((k) => `${STAT_LABEL[k]} +${mod?.[k]}`);
  const modDown = modKeys.filter((k) => (mod?.[k] ?? 0) < 0).map((k) => `${STAT_LABEL[k]} −${Math.abs(mod?.[k] ?? 0)}`);
  const dup = Math.max(0, (save.owned[id] ?? 0) - 1);

  // Level-up feedback: the number jumps and the head flashes when Lv rises.
  const prev = useRef(lv);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (lv > prev.current) setFlash((n) => n + 1);
    prev.current = lv;
  }, [lv]);

  return (
    <Sheet onClose={onClose} testId="chara-detail" closeTestId="chara-detail-close" className="detail">
      <div className={`detail__head detail__head--r${profile.rarity}`}>
        <div className="detail__rays"><SpeedLines /></div>
        {flash > 0 && <div key={flash} className="detail__flash" aria-hidden="true" />}
        <div className="detail__bust"><CharaBust look={profile.look} team={team} keeper={keeper} /></div>
        <div className="detail__id">
          <span className="detail__title">{profile.title}</span>
          <span className="a-head a-head--lg detail__name">{baseDef.name}</span>
          <Stars rarity={profile.rarity} size={16} />
          <span className="detail__types">
            <TypeChip type={profile.type} size={20} />
            <PosTag position={profile.position} />
            <span className="a-tag a-tag--dark">#{profile.number}</span>
          </span>
        </div>
      </div>
      <div className="detail__skill">
        <span className="a-tag a-tag--dark">SKILL</span>
        <b>{def.skills.length ? def.skills.map((s) => SKILL_LABEL[s]).join(' / ') : 'なし'}</b>
        <span className="detail__power">総合力 <b className="a-num" data-testid="detail-power">{power}</b></span>
      </div>
      <div className="detail__body">
        <StatBars charId={withPlus(id, lv - 1)} keeper={keeper} />
        {keeper ? (
          <p className="detail__kmove" data-testid="detail-keeper-note">ゴール前から動かない。シュートを止める。</p>
        ) : (
          <MoveDiagram moves={def.moves} />
        )}
      </div>
      {mod && (
        <p className="detail__poshint" data-testid="detail-posmod">
          {profile.position} 補正：<span className="is-up">{modUp.join(' ')}</span> ／ <span className="is-down">{modDown.join(' ')}</span>
        </p>
      )}
      <div className="detail__lv" data-testid="detail-level">
        <div className="detail__lvhead">
          <span key={flash} className={`a-num detail__lvnum${flash > 0 ? ' is-bump' : ''}`}>Lv.{lv}</span>
          <span className="a-num detail__lvmax">/ {META.level.max}</span>
          <span className="detail__lvbar">
            {Array.from({ length: META.level.max }, (_, i) => (
              <i key={i} className={i < lv ? 'is-on' : ''} />
            ))}
          </span>
        </div>
        {max ? (
          <div className="detail__lvbtn"><span className="a-tag detail__max" data-testid="chara-levelmax">MAX</span></div>
        ) : (
          <div className="detail__lvbtn">
            <button type="button" className="a-btn a-btn--yellow a-btn--sm" disabled={!can} onClick={() => onLevelUp(id)} data-testid="chara-levelup">
              <span>強化する <b className="a-num">{cost}</b></span>
            </button>
            <span className="detail__lvnote">{can ? '全能力 +1' : `あと ${(cost ?? 0) - save.coins} コイン`}</span>
          </div>
        )}
      </div>
      <p className="detail__quote">「{profile.quotes.duel}」</p>
      <div className="detail__foot">
        <span className="detail__dup">重複して引いた回数 <b className="a-num">{dup}</b></span>
        {inLineup ? (
          <span className="a-tag a-tag--blue detail__now" data-testid="chara-detail-now">編成中</span>
        ) : (
          <button type="button" className="a-btn a-btn--yellow a-btn--sm detail__set" onClick={() => onSet(id)} data-testid="chara-detail-set">
            <span>{keeper ? 'GK に編成する' : '編成に入れる'}</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}
