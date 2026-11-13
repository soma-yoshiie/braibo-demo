import { getCharacter } from '../../game/data/characters';
import { getProfile, splitCharId } from '../../game/data/roster';
import { CharaMedal, Crest, SpeedLines } from '../Chara';
import type { HalfTimeView } from '../viewTypes';
import './Overlays.css';

interface Props {
  view: HalfTimeView;
  blue: string[];
  red: string[];
  onNext: () => void;
  onHome: () => void;
}

function Ace({ team, id }: { team: 'blue' | 'red'; id: string }) {
  const p = getProfile(id);
  const plus = splitCharId(id).plus;
  const tag = team === 'blue' ? `Lv.${plus + 1}` : plus > 0 ? `+${plus}` : undefined;
  return (
    <div className="half__ace">
      <div className="half__medal">
        <CharaMedal look={p.look} team={team} number={p.number} abbr={getCharacter(id).abbr} rarity={p.rarity} tag={tag} />
      </div>
      <span>{p.name}</span>
    </div>
  );
}

/** Half-time card (DESIGN-UI §16.3). The controller holds the turn sequence until `onNext`. */
export function HalfTimeOverlay({ view, blue, red, onNext, onHome }: Props) {
  const kick = view.kickoffTeam === 'blue' ? '蒼嵐' : '紅蓮';
  return (
    <div className="overlay overlay--half a-stage" data-testid="halftime-overlay">
      <div className="vs__bg a-halftone" />
      <div className="vs__lines">
        <SpeedLines />
      </div>
      <div className="half__body">
        <div className="half__title a-head a-head--yellow">HALF TIME</div>
        <div className="half__plate a-panel">
          <span className="half__team half__team--blue">
            <Crest team="blue" size={24} />
            <b>蒼嵐</b>
          </span>
          <span className="half__score a-num">
            <span className="result__blue">{view.score.blue}</span>
            <span className="result__dash">-</span>
            <span className="result__red">{view.score.red}</span>
          </span>
          <span className="half__team half__team--red">
            <b>紅蓮</b>
            <Crest team="red" size={24} />
          </span>
        </div>
        <div className="half__aces">
          <Ace team="blue" id={blue[0] ?? ''} />
          <Ace team="red" id={red[0] ?? ''} />
        </div>
        <div className="half__kick a-panel a-panel--paper">後半は {kick} のキックオフ</div>
        <button className="a-btn a-btn--yellow a-btn--lg a-btn--block half__go" onClick={onNext} data-testid="halftime-next">
          <span>後半へ</span>
        </button>
        <button className="a-btn a-btn--dark a-btn--sm half__home" onClick={onHome} data-testid="halftime-home">
          <span>ホームへ</span>
        </button>
      </div>
    </div>
  );
}
