import { getProfile, splitCharId } from '../../game/data/roster';
import type { CharacterDef, SkillId, Stats } from '../../game/types';
import { CharaBust, Stars } from '../Chara';
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
  /** Raise over the archetype (shown in yellow as +n). */
  bonus: Partial<Stats>;
  skills: SkillId[];
  role: CharacterDef['role'];
}

const ROLE_LABEL: Record<CharacterDef['role'], string> = {
  striker: 'ストライカー',
  wing: 'ウイング',
  longShooter: 'ロングシューター',
  interceptor: 'インターセプター',
  physicalDefender: 'フィジカルDF',
};

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
            <CharaBust look={look} team={info.team} />
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
              <span className={`a-tag a-tag--${info.team}`} data-testid="info-role">
                {ROLE_LABEL[info.role]}
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
          <p className="card-sheet__desc">{info.description}</p>
          <ul className="card-sheet__stats">
            {STAT_ORDER.map((k) => {
              const label = STAT_LABEL[k];
              const bonus = info.bonus[k] ?? 0;
              return (
                <li key={k}>
                  <span className="card-sheet__k">{label}</span>
                  <span className="card-sheet__bar">
                    <i className={bonus > 0 ? 'is-up' : undefined} style={{ width: `${Math.max(2, Math.min(100, info.stats[k]))}%` }} />
                  </span>
                  <span className="card-sheet__v a-num">{info.stats[k]}</span>
                  <span className="card-sheet__up a-num">{bonus > 0 ? `+${bonus}` : ''}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
