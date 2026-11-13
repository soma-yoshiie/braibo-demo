import { getProfile } from '../../game/data/roster';
import { CharaBust, SpeedLines } from '../Chara';
import type { SaveCutInView } from '../viewTypes';
import './Overlays.css';

/** "SAVE!!" cut-in (DESIGN-UI §17.4). Timing is owned by the controller (1.2 s, a tap skips, reduced motion 700 ms). */
export function SaveCutIn({ view, onSkip }: { view: SaveCutInView | null; onSkip: () => void }) {
  if (!view) return null;
  const p = getProfile(view.charId);
  return (
    <div className={`savecut savecut--${view.team}`} key={view.key} data-testid="save-cutin" onClick={onSkip} role="presentation">
      <div className="savecut__plate" />
      <div className="goalfx__lines">
        <SpeedLines />
      </div>
      <div className="savecut__bust">
        <CharaBust look={p.look} team={view.team} expression="win" keeper />
      </div>
      <div className="a-head a-head--yellow savecut__title">SAVE!!</div>
      <div className="savecut__who">
        <span className={`a-tag a-tag--${view.team}`}>GK #{p.number}</span>
        <b>{p.name}</b>
      </div>
      <div className="savecut__rate a-num">
        セーブ率 <b>{Math.round(view.pSave * 100)}%</b>
      </div>
      <div className="savecut__quote a-panel a-panel--paper">「{p.quotes.duel}」</div>
    </div>
  );
}
