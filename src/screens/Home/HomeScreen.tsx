import { useEffect, useState } from 'react';
import { CharaBust, Crest, SpeedLines } from '../../components/Chara';
import { BottomNav } from '../../components/Shell/BottomNav';
import { DiffStars, behindText, mulText, rewardMulOf } from '../../components/Shell/bits';
import { HowToSheet, LoginSheet, SettingsSheet } from '../../components/Shell/Sheets';
import { TopBar } from '../../components/Shell/TopBar';
import { patchSettings, todayString, useToday, type Screen } from '../../components/Shell/actions';
import { charaInfo } from '../../components/Shell/chara';
import { SCOUT_POOL } from '../../game/data/roster';
import { claimLogin, claimableCount, loginBonus } from '../../meta/missions';
import { lineupOf, teamPower, type SaveData } from '../../meta/save';
import { fieldSlotOrder } from '../../game/data/formations';
import { nextStage, stageLineup } from '../../meta/stages';
import { saveStore } from '../../meta/store';
import '../../components/Shell/Shell.css';
import './Home.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  onPlay: (stageId: string) => void;
  qa?: string;
}

export function HomeScreen({ save, onNav, onPlay, qa }: Props) {
  const [sheet, setSheet] = useState<'howto' | 'settings' | null>(qa === 'howto' ? 'howto' : qa === 'settings' ? 'settings' : null);
  const today = useToday();
  const [loginOpen, setLoginOpen] = useState(() => loginBonus(saveStore.get(), todayString()) !== null);
  // A new day (app left open, tab shown again) brings the bonus back.
  useEffect(() => {
    if (loginBonus(saveStore.get(), today) !== null) setLoginOpen(true);
  }, [today]);
  const ace = fieldSlotOrder(save.lineup.field)[0] ?? save.lineup.field[0];
  const { profile, def, team } = charaInfo(ace);
  const next = nextStage(save);
  const myPower = teamPower(lineupOf(save));
  const rivalPower = teamPower(stageLineup(next));
  const claimable = claimableCount(save, today);
  const ownedCount = SCOUT_POOL.filter((p) => (save.owned[p.id] ?? 0) > 0).length;
  const { won, drawn, lost } = save.record;
  return (
    <div className="scr home" data-testid="home-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar
        title="HOME"
        save={save}
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
        <div className="home__next a-panel" data-testid="home-next">
          <span className="home__nextno a-num">STAGE {next.no}</span>
          <span className="home__nextname">
            <b>{next.name}</b>
            <span className="home__nextstars">
              <DiffStars n={next.stars} size={12} />
              {rewardMulOf(next) > 1 && <em className="home__mul">{mulText(rewardMulOf(next))}</em>}
            </span>
          </span>
          <span className="home__nextpow a-num">
            <span>相手 <b>{rivalPower}</b></span>
            <span>自分 <b className={myPower >= rivalPower ? 'is-ok' : 'is-behind'}>{myPower}</b>{behindText(myPower, rivalPower) && <em className="home__behind">{behindText(myPower, rivalPower)}</em>}</span>
          </span>
        </div>
        {claimable > 0 && (
          <button type="button" className="home__mission" onClick={() => onNav('mission')} data-testid="home-mission">
            <span className="home__missiondot a-num">{claimable}</span>
            受け取れるミッションがあります
          </button>
        )}
        <div className="home__play">
          <button type="button" className="a-btn a-btn--yellow a-btn--lg a-btn--block home__playbtn" onClick={() => onPlay(next.id)} data-testid="home-play">
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
      <BottomNav current="home" onNav={onNav} save={save} />
      {loginOpen && (
        <LoginSheet
          save={save}
          today={today}
          onClaim={() => {
            saveStore.update((cur) => claimLogin(cur, todayString()));
            setLoginOpen(false);
          }}
        />
      )}
      {sheet === 'howto' && <HowToSheet onClose={() => setSheet(null)} />}
      {sheet === 'settings' && (
        <SettingsSheet settings={save.settings} onPatch={patchSettings} onReset={() => saveStore.reset()} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
