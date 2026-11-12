import { useState } from 'react';
import { CharaBust, Crest, SpeedLines } from '../../components/Chara';
import { BottomNav } from '../../components/Shell/BottomNav';
import { HowToSheet, SettingsSheet } from '../../components/Shell/Sheets';
import { TopBar } from '../../components/Shell/TopBar';
import { patchSettings, type Screen } from '../../components/Shell/actions';
import { charaInfo } from '../../components/Shell/chara';
import { SCOUT_POOL } from '../../game/data/roster';
import type { SaveData } from '../../meta/save';
import { saveStore } from '../../meta/store';
import '../../components/Shell/Shell.css';
import './Home.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  onPlay: () => void;
  qa?: string;
}

export function HomeScreen({ save, onNav, onPlay, qa }: Props) {
  const [sheet, setSheet] = useState<'howto' | 'settings' | null>(qa === 'howto' ? 'howto' : qa === 'settings' ? 'settings' : null);
  const { profile, def, team } = charaInfo(save.lineup.striker);
  const ownedCount = SCOUT_POOL.filter((p) => (save.owned[p.id] ?? 0) > 0).length;
  const { won, drawn, lost } = save.record;
  return (
    <div className="scr home" data-testid="home-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar
        title="HOME"
        coins={save.coins}
        right={
          <button type="button" className="icon-btn" onClick={() => setSheet('settings')} aria-label="設定" data-testid="home-settings">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.6" />
              <circle cx="12" cy="12" r="2.2" fill="currentColor" />
              <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>
        }
      />
      <div className="scr__main home__main">
        <section className="home__hero">
          <div className="home__rays"><SpeedLines /></div>
          <div className="home__bust"><CharaBust look={profile.look} team={team} /></div>
          <div className="home__plate">
            <div className="home__team">
              <Crest team="blue" size={26} />
              <span className="a-head a-head--md">蒼嵐</span>
              <span className="a-tag a-tag--blue">ACE</span>
            </div>
            <span className="home__title">{profile.title}</span>
            <span className="a-head a-head--lg home__name">{def.name}</span>
            <div className="home__record" data-testid="home-record">
              <span><b className="a-num">{won}</b>勝</span>
              <span><b className="a-num">{drawn}</b>分</span>
              <span><b className="a-num">{lost}</b>敗</span>
            </div>
          </div>
        </section>
        <div className="home__play">
          <button type="button" className="a-btn a-btn--yellow a-btn--lg a-btn--block home__playbtn" onClick={onPlay} data-testid="home-play">
            <span>試合開始！</span>
          </button>
        </div>
        <div className="home__tiles">
          <button type="button" className="home__tile a-panel" onClick={() => onNav('box')} data-testid="home-tile-box">
            <b className="home__tilename">選手</b>
            <span className="a-num home__tilesub"><em>{ownedCount}</em> / {SCOUT_POOL.length}</span>
          </button>
          <button type="button" className="home__tile a-panel" onClick={() => onNav('team')} data-testid="home-tile-team">
            <b className="home__tilename">編成</b>
            <span className="a-num home__tilesub">TEAM</span>
          </button>
          <button type="button" className="home__tile a-panel" onClick={() => onNav('gacha')} data-testid="home-tile-gacha">
            <b className="home__tilename">スカウト</b>
            <span className="a-num home__tilesub">SCOUT</span>
          </button>
          <button type="button" className="home__tile a-panel" onClick={() => setSheet('howto')} data-testid="home-howto">
            <b className="home__tilename">遊び方</b>
            <span className="a-num home__tilesub">HOW TO</span>
          </button>
        </div>
      </div>
      <BottomNav current="home" onNav={onNav} />
      {sheet === 'howto' && <HowToSheet onClose={() => setSheet(null)} />}
      {sheet === 'settings' && (
        <SettingsSheet settings={save.settings} onPatch={patchSettings} onReset={() => saveStore.reset()} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
