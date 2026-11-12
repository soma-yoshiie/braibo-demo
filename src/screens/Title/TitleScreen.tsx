import { CharaBust, Crest, SpeedLines } from '../../components/Chara';
import { getProfile } from '../../game/data/roster';
import './Title.css';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  const blue = getProfile('st_kakeru');
  const red = getProfile('rv_enji');
  return (
    <div
      className="title"
      data-testid="title-screen"
      role="button"
      tabIndex={0}
      onClick={onStart}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onStart();
      }}
    >
      <div className="title__half title__half--blue">
        <div className="title__dots" />
        <div className="title__rays"><SpeedLines /></div>
        <div className="title__bust title__bust--blue"><CharaBust look={blue.look} team="blue" /></div>
        <Crest team="blue" size={44} className="title__crest title__crest--blue" />
      </div>
      <div className="title__half title__half--red">
        <div className="title__dots" />
        <div className="title__rays"><SpeedLines /></div>
        <div className="title__bust title__bust--red"><CharaBust look={red.look} team="red" flip /></div>
        <Crest team="red" size={44} className="title__crest title__crest--red" />
      </div>
      <div className="title__mid">
        <h1 className="title__logo a-head a-head--yellow" aria-label="BRAIBO">BRAIBO</h1>
        <div className="title__sub a-num">BRAIN × BALL</div>
      </div>
      <div className="title__start a-head a-head--md" data-testid="title-start">TAP TO START</div>
      <div className="title__ver">
        <span className="a-num">v0.6 PROTOTYPE</span>
        <span>キャラクターの絵は仮のものです</span>
      </div>
    </div>
  );
}
