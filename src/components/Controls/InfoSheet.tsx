import { getProfile, splitCharId } from '../../game/data/roster';
import { TYPE_LABEL } from '../../game/data/positions';
import type { Position, SkillId, Stats, TypeId } from '../../game/types';
import { CharaBust, Stars, TypeMark } from '../Chara';
import { SKILL_LABEL, STAT_LABEL, STAT_ORDER } from '../Shell/chara';
import './InfoSheet.css';

export interface InfoView {
  team: 'blue' | 'red';
  charId: string;
  name: string;
  title: string;
  rarity: 3 | 4 | 5;
  number: number;
  abbr: string;
  description: string;
  stats: Stats;
  /** Raise over the type's base (shown in yellow as +n). */
  bonus: Partial<Stats>;
  skills: SkillId[];
  type: TypeId;
  position: Position;
  /** Goalkeeper card: block = セーブ and aerial = ハイボール are the only stats used in a match. */
  keeper?: boolean;
  /** 「シュート n%（GK のセーブ m% 込み）」 for the player holding the ball (test id `shot-save-note`). */
  shotNote?: string;
}

const KEEPER_LABEL: Partial<Record<keyof Stats, string>> = { block: 'セーブ', aerial: 'ハイボール' };
const KEEPER_ORDER: (keyof Stats)[] = ['block', 'aerial', 'physical', 'shoot', 'longShot', 'pass', 'cross', 'intercept'];

interface Props {
  info: InfoView;
  onClose: () => void;
}

export function InfoSheet({ info, onClose }: Props) {
  const look = getProfile(info.charId).look;
  const plus = splitCharId(info.charId).plus;
  const lvTag = info.team === 'blue' ? `Lv.${plus + 1}` : plus > 0 ? `+${plus}` : null;
  return (
    <>
      {/* modal backdrop: swallows every pointer event so an outside tap only closes the sheet */}
      <div
        className="a-backdrop"
        data-testid="info-backdrop"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div className={`a-sheet a-panel card-sheet card-sheet--${info.team}`} data-testid="info-sheet" role="dialog" aria-modal="true">
        <div className="card-sheet__head a-halftone">
          <div className="card-sheet__bust">
            <CharaBust look={look} team={info.team} keeper={info.keeper} />
          </div>
          <div className="card-sheet__title">
            <i>{info.title}</i>
            <b className="a-head a-head--lg">
              {info.name}
              {lvTag && <span className="card-sheet__lv a-num">{lvTag}</span>}
            </b>
            <div className="card-sheet__meta">
              <Stars rarity={info.rarity} size={14} />
              <span className="a-num card-sheet__no">#{info.number}</span>
              <TypeMark type={info.type} size={20} />
              <span className={`a-tag a-tag--${info.team}`} data-testid="info-role">
                {TYPE_LABEL[info.type]} ／ {info.position}
              </span>
            </div>
          </div>
          <button className="card-sheet__close" onClick={onClose} aria-label="閉じる" data-testid="info-close">
            ✕
          </button>
        </div>
        <div className="card-sheet__body">
          {info.skills.length > 0 && (
            <div className="card-sheet__skills">
              <span className="a-num">SKILL</span>
              {info.skills.map((s) => (
                <b key={s}>{SKILL_LABEL[s]}</b>
              ))}
            </div>
          )}
          {info.shotNote && (
            <p className="card-sheet__note" data-testid="shot-save-note">
              {info.shotNote}
            </p>
          )}
          <p className="card-sheet__desc">{info.keeper ? 'ゴール前から動かない。シュートを止める。' : info.description}</p>
          <ul className="card-sheet__stats">
            {(info.keeper ? KEEPER_ORDER : STAT_ORDER).map((k) => {
              const dim = !!info.keeper && k !== 'block' && k !== 'aerial';
              const label = info.keeper ? (KEEPER_LABEL[k] ?? STAT_LABEL[k]) : STAT_LABEL[k];
              const bonus = info.bonus[k] ?? 0;
              return (
                <li key={k} className={dim ? 'is-dim' : undefined}>
                  <span className="card-sheet__k">{label}</span>
                  <span className="card-sheet__bar">
                    <i className={bonus > 0 ? 'is-up' : undefined} style={{ width: `${Math.max(2, Math.min(100, info.stats[k]))}%` }} />
                  </span>
                  <span className="card-sheet__v a-num">{info.stats[k]}</span>
                  <span className="card-sheet__up a-num">{dim ? '' : bonus > 0 ? `+${bonus}` : ''}</span>
                </li>
              );
            })}
          </ul>
          {info.keeper && <p className="card-sheet__unused">薄い能力は試合では使いません</p>}
        </div>
      </div>
    </>
  );
}
