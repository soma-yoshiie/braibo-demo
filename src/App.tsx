/// <reference types="vite/client" />
import { Suspense, lazy, useMemo, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Screen } from './components/Shell/actions';
import { patchSettings, todayString } from './components/Shell/actions';
import { applyMatchResult, lineupOf, summarizeMatch, type ResultSummary } from './meta/save';
import { getStage, nextStage, stageLineup } from './meta/stages';
import { saveStore, useSave } from './meta/store';
import { BoxScreen } from './screens/Box/BoxScreen';
import { GachaScreen } from './screens/Gacha/GachaScreen';
import { HomeScreen } from './screens/Home/HomeScreen';
import { MatchScreen } from './screens/MatchScreen/MatchScreen';
import { MissionScreen } from './screens/Mission/MissionScreen';
import { StageScreen } from './screens/Stage/StageScreen';
import { TeamScreen } from './screens/Team/TeamScreen';
import { TitleScreen } from './screens/Title/TitleScreen';

// Dev-only: the gallery chunk is dropped from production builds.
const CharaGallery = import.meta.env.DEV ? lazy(() => import('./dev/CharaGallery')) : null;

const SCREENS: Screen[] = ['title', 'home', 'stage', 'box', 'team', 'gacha', 'mission', 'match'];

/**
 * Deep links for checking: #home #stage #box #team #gacha #mission #match, #gallery.
 * DEV-only QA extras (ignored in production builds), after a colon: #home:howto #home:settings #box:<charId> #team:<0..4|gk> #gacha:rates|ball|cut|result.
 */
function parseHash(): { screen: Screen; qa?: string; gallery: boolean } {
  const raw = typeof location === 'undefined' ? '' : location.hash.replace(/^#/, '');
  const [name, qaRaw] = raw.split(':');
  const qa = import.meta.env.DEV ? qaRaw : undefined;
  if (import.meta.env.DEV && name === 'gallery') return { screen: 'title', gallery: true };
  const screen = SCREENS.find((s) => s === name);
  return { screen: screen && screen !== 'title' ? screen : 'title', qa, gallery: false };
}

export function App() {
  const [initial] = useState(parseHash);
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [qa, setQa] = useState<string | undefined>(initial.qa);
  const [save] = useSave();
  const [stageId, setStageId] = useState(() => nextStage(saveStore.get()).id);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [matchNo, setMatchNo] = useState(0);
  /** A player carried from the box to the team screen (「編成に入れる」). */
  const [holding, setHolding] = useState<string | null>(null);
  // Lineups are fixed when a match starts (stable identity for the match screen).
  const lineups = useMemo(() => {
    const st = getStage(stageId) ?? nextStage(saveStore.get());
    return { blue: lineupOf(saveStore.get()), red: stageLineup(st) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId, matchNo]);

  if (initial.gallery && CharaGallery) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <CharaGallery />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }

  const go = (s: Screen) => {
    setQa(undefined);
    setHolding(null);
    setScreen(s);
  };
  const holdAndGoTeam = (id: string) => {
    setQa(undefined);
    setHolding(id);
    setScreen('team');
  };
  const play = (id: string) => {
    setStageId(id);
    setSummary(null);
    setMatchNo((n) => n + 1);
    go('match');
  };
  const stage = getStage(stageId) ?? nextStage(save);

  let body;
  switch (screen) {
    case 'title':
      body = <TitleScreen onStart={() => go('home')} />;
      break;
    case 'home':
      body = <HomeScreen save={save} onNav={go} onPlay={play} qa={qa} />;
      break;
    case 'stage':
      body = <StageScreen save={save} onNav={go} onPlay={play} />;
      break;
    case 'box':
      body = <BoxScreen save={save} onNav={go} onToTeam={holdAndGoTeam} qa={qa} />;
      break;
    case 'team':
      body = <TeamScreen save={save} onNav={go} holding={holding} onHoldDone={() => setHolding(null)} qa={qa} />;
      break;
    case 'gacha':
      body = <GachaScreen save={save} onNav={go} qa={qa} />;
      break;
    case 'mission':
      body = <MissionScreen save={save} onNav={go} />;
      break;
    case 'match':
      body = (
        <MatchScreen
          lineups={lineups}
          settings={save.settings}
          stage={{ no: stage.no, name: stage.name, stars: stage.stars }}
          summary={summary}
          onSettings={patchSettings}
          onRematch={() => setSummary(null)}
          onFinished={(score) => {
            // Summarise against the save from before this match, then apply it.
            const before = saveStore.get();
            setSummary(summarizeMatch(before, stage.id, score));
            saveStore.update((s) => applyMatchResult(s, stage.id, score, todayString()));
          }}
          onHome={() => go('home')}
        />
      );
      break;
  }
  return <ErrorBoundary>{body}</ErrorBoundary>;
}
