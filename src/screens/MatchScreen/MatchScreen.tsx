import { ActionBar } from '../../components/Controls/ActionBar';
import { InfoSheet } from '../../components/Controls/InfoSheet';
import { HUD } from '../../components/HUD/HUD';
import { EventBanner, GoalFx } from '../../components/Overlays/EventBanner';
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
      <div className="turf" aria-hidden="true" />
      <HUD
        score={m.score}
        turn={m.state.turn}
        maxTurns={m.state.maxTurns}
        possession={m.possession}
        secondsLeft={m.secondsLeft}
        bump={m.bump}
        onOpenLog={() => m.setLogOpen(true)}
        onRestart={m.restart}
        menuOpen={m.hudMenuOpen}
        onMenuOpenChange={m.setHudMenuOpen}
        busy={m.phase === 'resolving'}
      />
      <main className="board">
        <Pitch
          tokens={m.tokens}
          ball={m.ball}
          trajectory={m.trajectory}
          selectedId={m.interactive || m.phase === 'start' ? m.selectedId : null}
          inspectId={m.interactive ? m.inspectId : null}
          moveTargets={m.moveTargets}
          passTargets={m.passTargets}
          spaceCells={m.spaceCells}
          picking={m.picking}
          offsideLine={m.offsideLine}
          offsideLineOwn={m.offsideLineOwn}
          offPosIds={m.offPosIds}
          throughEarly={m.throughEarly}
          plans={m.planViews}
          ballArrow={m.ballArrow}
          bursts={m.bursts}
          radial={m.radial}
          interactive={m.interactive}
          onCellTap={m.onCellTap}
          onPlayerTap={m.onPlayerTap}
          onGhostTap={m.onGhostTap}
          spread={m.spread}
        />
        {m.hint && (
          <div
            className={`hint${m.hint.warn ? ' hint--warn' : ''}${m.hint.slim ? ' hint--slim' : ''}`}
            data-testid={m.hint.warn ? 'notice' : 'hint'}
          >
            {m.hint.text && <b>{m.hint.text}</b>}
            {m.hint.sub && <span>{m.hint.sub}</span>}
          </div>
        )}
      </main>
      <EventBanner banner={m.banner} />
      <GoalFx fxKey={m.goalFx} />
      <ActionBar
        plannedCount={m.plannedCount}
        total={m.totalPlayers}
        disabled={locked}
        onReset={m.onReset}
        onExecute={m.execute}
        passStyle={m.passStyleBar}
        onPassStyle={m.setPassStyle}
      />
      {m.info && m.interactive && <InfoSheet info={m.info} onClose={m.closeInfo} />}
      {m.phase === 'start' && (
        <StartOverlay
          timerOn={m.timerOn}
          seconds={TIMER_SECONDS}
          onToggleTimer={m.setTimerOn}
          throughOn={m.throughOn}
          onToggleThrough={m.setThrough}
          onStart={m.start}
        />
      )}
      {m.phase === 'finished' && <ResultOverlay score={m.state.score} onAgain={m.restart} onLog={() => m.setLogOpen(true)} />}
      {m.logOpen && <LogDrawer lines={m.log} onClose={() => m.setLogOpen(false)} />}
    </div>
  );
}
