import { useState } from 'react';
import { BottomNav } from '../../components/Shell/BottomNav';
import { coinText } from '../../components/Shell/bits';
import { TopBar } from '../../components/Shell/TopBar';
import { todayString, useToday, type Screen } from '../../components/Shell/actions';
import { claimAllMissions, claimMission, claimableCount, missionStates } from '../../meta/missions';
import type { SaveData } from '../../meta/save';
import { saveStore } from '../../meta/store';
import '../../components/Shell/Shell.css';
import './Mission.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
}

export function MissionScreen({ save, onNav }: Props) {
  const [tab, setTab] = useState<'daily' | 'normal'>('daily');
  const [pop, setPop] = useState<{ n: number; key: number } | null>(null);
  const today = useToday();
  const all = missionStates(save, today);
  const rows = all.filter((m) => m.def.kind === tab);
  const claimable = claimableCount(save, today);
  const dailyClaimable = all.filter((m) => m.def.kind === 'daily' && m.done && !m.claimed).length;
  const normalClaimable = all.filter((m) => m.def.kind === 'normal' && m.done && !m.claimed).length;

  const showPop = (n: number) => setPop((p) => ({ n, key: (p?.key ?? 0) + 1 }));
  const claimOne = (id: string) => {
    const before = saveStore.get().coins;
    saveStore.update((s) => claimMission(s, id, todayString()));
    const gained = saveStore.get().coins - before;
    if (gained > 0) showPop(gained);
  };
  const claimAll = () => {
    const before = saveStore.get().coins;
    const r = claimAllMissions(saveStore.get(), todayString());
    saveStore.update(() => r.save);
    const gained = saveStore.get().coins - before;
    if (gained > 0) showPop(gained);
  };

  return (
    <div className="scr mission" data-testid="mission-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar title="ミッション" save={save} />
      <div className="scr__main mission__main">
        <div className="mission__tabs">
          <button type="button" className={tab === 'daily' ? 'is-on' : ''} onClick={() => setTab('daily')} data-testid="mission-tab-daily">
            デイリー{dailyClaimable > 0 && <i className="mission__dot a-num">{dailyClaimable}</i>}
          </button>
          <button type="button" className={tab === 'normal' ? 'is-on' : ''} onClick={() => setTab('normal')} data-testid="mission-tab-normal">
            通常{normalClaimable > 0 && <i className="mission__dot a-num">{normalClaimable}</i>}
          </button>
        </div>
        <div className="mission__bar">
          <p className="mission__note">{tab === 'daily' ? 'デイリーは日付が変わると最初に戻ります。' : '一度きりのミッションです。'}</p>
          <button type="button" className="a-btn a-btn--yellow" disabled={claimable === 0} onClick={claimAll} data-testid="mission-claim-all">
            <span>まとめて受け取る</span>
          </button>
        </div>
        <ul className="mission__list" data-testid="mission-list">
          {rows.map((m) => {
            const state = m.claimed ? 'claimed' : m.done ? 'ready' : 'doing';
            return (
              <li key={m.def.id} className={`mrow is-${state}`} data-testid={`mission-row-${m.def.id}`}>
                <div className="mrow__main">
                  <b className="mrow__title">{m.def.title}</b>
                  <span className="mrow__prog">
                    <span className="mrow__bar"><i style={{ width: `${(m.progress / m.def.goal) * 100}%` }} /></span>
                    <span className="a-num mrow__n">{m.progress} / {m.def.goal}</span>
                  </span>
                </div>
                <span className="a-num mrow__reward">{coinText(m.def.reward)}</span>
                {state === 'ready' ? (
                  <button type="button" className="a-btn a-btn--yellow a-btn--sm mrow__btn mrow__btn--pop" onClick={() => claimOne(m.def.id)} data-testid={`mission-claim-${m.def.id}`}>
                    <span>受け取る</span>
                  </button>
                ) : (
                  <span className="mrow__state" data-testid={`mission-state-${m.def.id}`}>{state === 'claimed' ? '受け取り済み' : '挑戦中'}</span>
                )}
              </li>
            );
          })}
        </ul>
        {pop && (
          <div key={pop.key} className="mission__pop a-num" data-testid="mission-pop" aria-live="polite">{coinText(pop.n)}</div>
        )}
      </div>
      <BottomNav current="mission" onNav={onNav} save={save} />
    </div>
  );
}
