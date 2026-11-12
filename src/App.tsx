/// <reference types="vite/client" />
import { Suspense, lazy, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Screen } from './components/Shell/actions';
import { patchSettings } from './components/Shell/actions';
import { RIVAL_LINEUP } from './game/data/roster';
import { applyMatchResult, lineupIds } from './meta/save';
import { saveStore, useSave } from './meta/store';
import { BoxScreen } from './screens/Box/BoxScreen';
import { GachaScreen } from './screens/Gacha/GachaScreen';
import { HomeScreen } from './screens/Home/HomeScreen';
import { MatchScreen } from './screens/MatchScreen/MatchScreen';
import { TeamScreen } from './screens/Team/TeamScreen';
import { TitleScreen } from './screens/Title/TitleScreen';

// Dev-only: the gallery chunk is dropped from production builds.
const CharaGallery = import.meta.env.DEV ? lazy(() => import('./dev/CharaGallery')) : null;

const SCREENS: Screen[] = ['title', 'home', 'box', 'team', 'gacha', 'match'];

/**
 * Deep links for checking: #home #box #team #gacha #match, #gallery.
 * DEV-only QA extras (ignored in production builds), after a colon: #home:howto #home:settings #box:<charId> #team:<roleId> #gacha:rates|ball|cut|result.
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
  const [lineups, setLineups] = useState(() => ({ blue: lineupIds(saveStore.get()), red: RIVAL_LINEUP }));

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
    setScreen(s);
  };
  const play = () => {
    setLineups({ blue: lineupIds(saveStore.get()), red: RIVAL_LINEUP });
    go('match');
  };

  let body;
  switch (screen) {
    case 'title':
      body = <TitleScreen onStart={() => go('home')} />;
      break;
    case 'home':
      body = <HomeScreen save={save} onNav={go} onPlay={play} qa={qa} />;
      break;
    case 'box':
      body = <BoxScreen save={save} onNav={go} qa={qa} />;
      break;
    case 'team':
      body = <TeamScreen save={save} onNav={go} qa={qa} />;
      break;
    case 'gacha':
      body = <GachaScreen save={save} onNav={go} qa={qa} />;
      break;
    case 'match':
      body = (
        <MatchScreen
          lineups={lineups}
          settings={save.settings}
          onSettings={patchSettings}
          onFinished={(score) => saveStore.update((s) => applyMatchResult(s, score))}
          onHome={() => go('home')}
        />
      );
      break;
  }
  return <ErrorBoundary>{body}</ErrorBoundary>;
}
