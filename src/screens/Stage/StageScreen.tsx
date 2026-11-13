import { splitCharId } from '../../game/data/roster';
import { BottomNav } from '../../components/Shell/BottomNav';
import { Avatar } from '../../components/Shell/CharaCard';
import { DiffStars, behindText, coinText, mulText, rewardMulOf } from '../../components/Shell/bits';
import { TopBar } from '../../components/Shell/TopBar';
import type { Screen } from '../../components/Shell/actions';
import { levelOf, lineupOf, teamPower, type SaveData } from '../../meta/save';
import { STAGES, isUnlocked, stageLineup } from '../../meta/stages';
import '../../components/Shell/Shell.css';
import './Stage.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  onPlay: (stageId: string) => void;
}

export function StageScreen({ save, onNav, onPlay }: Props) {
  const lineup = lineupOf(save);
  const myPower = teamPower(lineup);
  const faces = [...lineup.field, lineup.gk];
  return (
    <div className="scr stage" data-testid="stage-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar title="ステージ" save={save} />
      <div className="scr__main stage__main">
        <button type="button" className="stage__team a-panel" onClick={() => onNav('team')} data-testid="stage-team">
          <span className="stage__teamlbl">
            <span className="a-head a-head--sm">総合力</span>
            <b className="a-num stage__teampow">{myPower}</b>
          </span>
          <span className="stage__faces">
            {faces.map((id, i) => (
              <span key={id + i} className={`stage__face${i === faces.length - 1 ? ' is-gk' : ''}`}>
                <Avatar id={id} tag={`Lv.${levelOf(save, splitCharId(id).base)}`} />
              </span>
            ))}
          </span>
        </button>
        <ul className="stage__list" data-testid="stage-list">
          {STAGES.map((st, i) => {
            const rec = save.stages[st.id];
            const open = isUnlocked(save, st.id);
            const power = teamPower(stageLineup(st));
            const cleared = rec?.cleared === true;
            return (
              <li key={st.id}>
                <button
                  type="button"
                  className={`scard${cleared ? ' is-clear' : ''}${open ? '' : ' is-locked'}`}
                  disabled={!open}
                  onClick={() => onPlay(st.id)}
                  data-testid={`stage-card-${st.id}`}
                >
                  <span className="scard__no">
                    <span className="a-num scard__nolbl">STAGE</span>
                    <b className="a-num scard__nonum">{st.no}</b>
                  </span>
                  <span className="scard__body">
                    <b className="scard__name">{st.name}</b>
                    <span className="scard__note">{open ? st.note : `STAGE ${i} をクリアで解放`}</span>
                    <span className="scard__row">
                      <DiffStars n={st.stars} size={12} />
                      <span className="a-num scard__pow">相手 {power}</span>
                      {behindText(myPower, power) && <span className="scard__behind">{behindText(myPower, power)}</span>}
                    </span>
                  </span>
                  <span className="scard__reward">
                    <span className="scard__rlbl">{cleared ? '初クリア済み' : '初クリア報酬'}</span>
                    <b className={`a-num scard__rcoin${cleared ? ' is-got' : ''}`}>{coinText(st.firstClear)}</b>
                    {rewardMulOf(st) > 1 && <span className="scard__mul">{mulText(rewardMulOf(st))}</span>}
                  </span>
                  {cleared && <span className="scard__stamp a-num" aria-label="クリア済み">CLEAR</span>}
                  {!open && (
                    <span className="scard__lock" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="28" height="28">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#ffd34d" stroke="#151a2d" strokeWidth="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#151a2d" strokeWidth="2.6" />
                      </svg>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <BottomNav current="stage" onNav={onNav} save={save} />
    </div>
  );
}
