import { getCharacter } from '../../game/data/characters';
import { getProfile, splitCharId } from '../../game/data/roster';
import type { TeamLineup } from '../../game/types';
import { formationCounts, teamPower } from '../../meta/save';
import { CharaMedal, Crest, SpeedLines } from '../Chara';
import './Overlays.css';

interface Props {
  blue: TeamLineup;
  red: TeamLineup;
  timerOn: boolean;
  seconds: number;
  onToggleTimer: (v: boolean) => void;
  throughOn: boolean;
  onToggleThrough: (v: boolean) => void;
  onStart: () => void;
  onHome: () => void;
  trapOn: boolean;
  onToggleTrap: (v: boolean) => void;
  stage?: { no: number; name: string; stars: number };
}

function Squad({ team, lineup }: { team: 'blue' | 'red'; lineup: TeamLineup }) {
  const ids = [...lineup.field, lineup.gk];
  const fc = formationCounts(lineup);
  return (
    <section className={`vs__team vs__team--${team}`}>
      <div className="vs__head">
        <Crest team={team} size={22} />
        <b className="a-head a-head--md">{team === 'blue' ? '蒼嵐' : '紅蓮'}</b>
        <span className={`a-tag a-tag--${team}`}>{team === 'blue' ? 'YOU' : 'AI'}</span>
      </div>
      <div className="vs__power a-num">
        <span className="vs__form" data-testid={`formation-${team}`}>DF {fc.DF}・MF {fc.MF}・FW {fc.FW}</span>
        <span>総合力</span>
        <b>{teamPower(lineup)}</b>
      </div>
      <div className="vs__row">
        {ids.map((id, i) => {
          const keeper = i === ids.length - 1;
          const p = getProfile(id);
          const plus = splitCharId(id).plus;
          const tag = team === 'blue' ? `Lv.${plus + 1}` : plus > 0 ? `+${plus}` : undefined;
          return (
            <div key={id} className={`vs__who${keeper ? ' vs__who--gk' : ''}`}>
              <div className="vs__medal">
                <CharaMedal look={p.look} team={team} number={p.number} abbr={getCharacter(id).abbr} rarity={p.rarity} tag={tag} type={getCharacter(id).type} keeper={keeper} />
              </div>
              <span>{p.name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StartOverlay({ blue, red, timerOn, seconds, onToggleTimer, throughOn, onToggleThrough, onStart, onHome, stage, trapOn, onToggleTrap }: Props) {
  return (
    <div className="overlay overlay--start a-stage" data-testid="start-overlay">
      <div className="vs__bg a-halftone" />
      <div className="vs__lines">
        <SpeedLines />
      </div>
      <div className="vs__body">
        <Squad team="red" lineup={red} />
        <div className="vs__mid">
          {stage && (
            <div className="vs__stage a-panel">
              <span className="a-num">STAGE {stage.no}</span>
              <b>{stage.name}</b>
              <span className="vs__stars" aria-label={`難しさ ${stage.stars}`}>
                {'★'.repeat(stage.stars)}
                <i>{'★'.repeat(Math.max(0, 5 - stage.stars))}</i>
              </span>
            </div>
          )}
          <span className="vs__vs a-head a-head--yellow" aria-hidden="true">VS</span>
        </div>
        <Squad team="blue" lineup={blue} />
        <div className="vs__opts">
          <label className="opt">
            <span>作戦タイマー（{seconds}秒）</span>
            <input type="checkbox" checked={timerOn} onChange={(e) => onToggleTimer(e.target.checked)} />
            <i className="opt__track" />
          </label>
          <label className="opt">
            <span>オフサイドトラップ</span>
            <input type="checkbox" checked={trapOn} onChange={(e) => onToggleTrap(e.target.checked)} data-testid="trap-toggle" />
            <i className="opt__track" />
          </label>
          <label className="opt">
            <span>先出しスルーパス</span>
            <input type="checkbox" checked={throughOn} onChange={(e) => onToggleThrough(e.target.checked)} data-testid="through-toggle" />
            <i className="opt__track" />
          </label>
        </div>
        <button className="a-btn a-btn--yellow a-btn--lg a-btn--block vs__go" onClick={onStart} data-testid="start-button">
          <span>キックオフ！</span>
        </button>
        <button className="a-btn a-btn--dark a-btn--sm vs__home" onClick={onHome} data-testid="start-home">
          <span>ホームへ</span>
        </button>
      </div>
    </div>
  );
}
