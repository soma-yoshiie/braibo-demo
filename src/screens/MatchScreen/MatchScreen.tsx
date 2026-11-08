import { CommandPanel } from '../../components/Controls/CommandPanel';
import { HUD } from '../../components/HUD/HUD';
import { EventBanner } from '../../components/Overlays/EventBanner';
import { LogDrawer } from '../../components/Overlays/LogDrawer';
import { ResultOverlay } from '../../components/Overlays/ResultOverlay';
import { StartOverlay } from '../../components/Overlays/StartOverlay';
import { Pitch } from '../../components/Pitch/Pitch';
import { TIMER_SECONDS, useMatchController } from './useMatchController';
import './MatchScreen.css';

export function MatchScreen() {
  const m = useMatchController();
  const locked = !m.interactive;
  return (
    <div className="shell">
      <HUD
        score={m.state.score}
        turn={m.state.turn}
        maxTurns={m.state.maxTurns}
        possession={m.possession}
        secondsLeft={m.secondsLeft}
        onOpenLog={() => m.setLogOpen(true)}
        onRestart={m.restart}
        busy={m.phase === 'resolving'}
      />
      <main className="pitch-area">
        <Pitch
          tokens={m.tokens}
          ball={m.ball}
          selectedId={m.interactive || m.phase === 'start' ? m.selectedId : null}
          inspectId={m.interactive ? m.inspectId : null}
          moveTargets={m.moveTargets}
          passTargets={m.passTargets}
          plans={m.planViews}
          ballArrow={m.ballArrow}
          badges={m.badges}
          interactive={m.interactive}
          onCellTap={m.onCellTap}
          onPlayerTap={m.onPlayerTap}
          onGhostTap={m.onGhostTap}
        />
        <EventBanner banner={m.banner} />
      </main>
      <CommandPanel
        chips={m.chips}
        info={m.info}
        actions={m.actions}
        plannedCount={m.plannedCount}
        total={m.chips.length}
        disabled={locked}
        notice={m.notice}
        onChip={m.onChip}
        onKeep={m.onKeep}
        onPass={m.onPass}
        onCross={m.onCross}
        onShoot={m.onShoot}
        onReset={m.onReset}
        onExecute={m.execute}
      />
      {m.phase === 'start' && (
        <StartOverlay
          timerOn={m.timerOn}
          seconds={TIMER_SECONDS}
          onToggleTimer={m.setTimerOn}
          onStart={m.start}
        />
      )}
      {m.phase === 'finished' && <ResultOverlay score={m.state.score} onAgain={m.restart} onLog={() => m.setLogOpen(true)} />}
      {m.logOpen && <LogDrawer lines={m.log} onClose={() => m.setLogOpen(false)} />}
    </div>
  );
}
