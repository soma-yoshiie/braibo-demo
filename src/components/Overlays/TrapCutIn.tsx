import { getProfile } from '../../game/data/roster';
import { CharaBust, SpeedLines } from '../Chara';
import type { TrapCutInView } from '../viewTypes';
import './Overlays.css';

/** "TRAP!" cut-in (DESIGN-UI §16.2). Timing is owned by the controller (1.2 s, a tap skips, reduced motion 700 ms). */
export function TrapCutIn({ view, onSkip }: { view: TrapCutInView | null; onSkip: () => void }) {
  if (!view) return null;
  const p = getProfile(view.charId);
  return (
    <div className={`trapcut trapcut--${view.team}`} key={view.key} data-testid="trap-cutin" onClick={onSkip} role="presentation">
      <div className="goalfx__bg a-halftone" />
      <div className="goalfx__lines">
        <SpeedLines />
      </div>
      <div className="trapcut__bust">
        <CharaBust look={p.look} team={view.team} expression="win" />
      </div>
      <div className="trapcut__flag" aria-hidden="true" />
      <div className="a-head a-head--yellow trapcut__title">TRAP!</div>
      <div className="trapcut__sub a-head">オフサイドトラップ!!</div>
      <div className="trapcut__who">
        <span className={`a-tag a-tag--${view.team}`}>#{p.number}</span>
        <b>{p.name}</b>
      </div>
      <div className="trapcut__quote a-panel a-panel--paper">「{p.quotes.duel}」</div>
    </div>
  );
}
