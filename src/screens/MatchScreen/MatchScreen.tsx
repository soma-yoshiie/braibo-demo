import { ActionBar } from '../../components/Controls/ActionBar';
import { InfoSheet } from '../../components/Controls/InfoSheet';
import { HUD } from '../../components/HUD/HUD';
import { EventBanner, GoalFx } from '../../components/Overlays/EventBanner';
import { LogDrawer } from '../../components/Overlays/LogDrawer';
import { ResultOverlay } from '../../components/Overlays/ResultOverlay';
import { StartOverlay } from '../../components/Overlays/StartOverlay';
import { Pitch } from '../../components/Pitch/Pitch';
import { DuelCutIn } from '../../components/Overlays/DuelCutIn';
import { HalfTimeOverlay } from '../../components/Overlays/HalfTimeOverlay';
import { SaveCutIn } from '../../components/Overlays/SaveCutIn';
import { TrapCutIn } from '../../components/Overlays/TrapCutIn';
import { TIMER_SECONDS, useMatchController } from './useMatchController';
import type { MatchScreenProps } from './useMatchController';
import './MatchScreen.css';

export type { MatchScreenProps } from './useMatchController';

export function MatchScreen(props: MatchScreenProps) {
  const m = useMatchController(props);
  const locked = !m.interactive;
  return (
    <div className="shell">
      <div className="turf" aria-hidden="true" />
      <HUD
        score={m.score}
        turn={m.state.turn}
        maxTurns={m.state.maxTurns}
        half={m.half}
        possession={m.possession}
        secondsLeft={m.secondsLeft}
        timerMax={TIMER_SECONDS}
        bump={m.bump}
        onOpenLog={() => m.setLogOpen(true)}
        onRestart={m.restart}
        onHome={props.onHome}
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
          offsideLineLabel={m.offsideLineLabel}
          trap={m.trap}
          keepers={m.keepers}
          onKeeperTap={m.onKeeperTap}
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
      <GoalFx fx={m.goalFx} onSkip={m.endCutIn} />
      <DuelCutIn view={m.cutIn} onSkip={m.endCutIn} />
      <TrapCutIn view={m.trapCut} onSkip={m.endCutIn} />
      <SaveCutIn view={m.saveCut} onSkip={m.endCutIn} />
      <ActionBar
        plannedCount={m.plannedCount}
        total={m.totalPlayers}
        disabled={locked}
        onReset={m.onReset}
        onExecute={m.execute}
        selected={m.interactive || m.phase === 'start' ? m.selectedView : null}
        onOpenInfo={m.openSelectedInfo}
        trap={m.trapBar}
        passStyle={m.passStyleBar}
        onPassStyle={m.setPassStyle}
      />
      {m.info && m.interactive && <InfoSheet info={m.info} onClose={m.closeInfo} />}
      {m.phase === 'start' && (
        <StartOverlay
          blue={props.lineups.blue}
          red={props.lineups.red}
          onHome={props.onHome}
          stage={props.stage}
          trapOn={m.trapOn}
          onToggleTrap={m.setTrap}
          timerOn={m.timerOn}
          seconds={TIMER_SECONDS}
          onToggleTimer={m.setTimerOn}
          throughOn={m.throughOn}
          onToggleThrough={m.setThrough}
          onStart={m.start}
        />
      )}
      {m.phase === 'finished' && (
        <ResultOverlay
          score={m.state.score}
          blue={props.lineups.blue.field}
          red={props.lineups.red.field}
          summary={props.summary}
          onAgain={() => {
            props.onRematch?.();
            m.restart();
          }}
          onHome={props.onHome}
          onLog={() => m.setLogOpen(true)}
        />
      )}
      {m.halfView && <HalfTimeOverlay view={m.halfView} blue={props.lineups.blue.field} red={props.lineups.red.field} onNext={m.resumeHalf} onHome={props.onHome} />}
      {m.logOpen && <LogDrawer lines={m.log} onClose={() => m.setLogOpen(false)} />}
    </div>
  );
}
