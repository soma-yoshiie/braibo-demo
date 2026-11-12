import { getCharacter } from '../../game/data/characters';
import { getProfile } from '../../game/data/roster';
import { CharaMedal, Crest, SpeedLines } from '../Chara';
import './Overlays.css';

interface Props {
  blue: string[];
  red: string[];
  timerOn: boolean;
  seconds: number;
  onToggleTimer: (v: boolean) => void;
  throughOn: boolean;
  onToggleThrough: (v: boolean) => void;
  onStart: () => void;
  onHome: () => void;
}

function Squad({ team, ids }: { team: 'blue' | 'red'; ids: string[] }) {
  return (
    <section className={`vs__team vs__team--${team}`}>
      <div className="vs__head">
        <Crest team={team} size={22} />
        <b className="a-head a-head--md">{team === 'blue' ? '蒼嵐' : '紅蓮'}</b>
        <span className={`a-tag a-tag--${team}`}>{team === 'blue' ? 'YOU' : 'AI'}</span>
      </div>
      <div className="vs__row">
        {ids.map((id) => {
          const p = getProfile(id);
          return (
            <div key={id} className="vs__who">
              <div className="vs__medal">
                <CharaMedal look={p.look} team={team} number={p.number} abbr={getCharacter(id).abbr} rarity={p.rarity} />
              </div>
              <span>{p.name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StartOverlay({ blue, red, timerOn, seconds, onToggleTimer, throughOn, onToggleThrough, onStart, onHome }: Props) {
  return (
    <div className="overlay overlay--start a-stage" data-testid="start-overlay">
      <div className="vs__bg a-halftone" />
      <div className="vs__lines">
        <SpeedLines />
      </div>
      <div className="vs__body">
        <Squad team="red" ids={red} />
        <div className="vs__mid" aria-hidden="true">
          <span className="vs__vs a-head a-head--yellow">VS</span>
        </div>
        <Squad team="blue" ids={blue} />
        <div className="vs__opts">
          <label className="opt">
            <span>作戦タイマー（{seconds}秒）</span>
            <input type="checkbox" checked={timerOn} onChange={(e) => onToggleTimer(e.target.checked)} />
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
