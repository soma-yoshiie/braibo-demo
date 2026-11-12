import { useState } from 'react';
import { CharaBust, SpeedLines } from '../../components/Chara';
import { BottomNav } from '../../components/Shell/BottomNav';
import { RatesSheet } from '../../components/Shell/Sheets';
import { TopBar } from '../../components/Shell/TopBar';
import type { Screen } from '../../components/Shell/actions';
import { charaInfo } from '../../components/Shell/chara';
import { createRng, randomSeed } from '../../game/engine/rng';
import { META } from '../../meta/config';
import { applyGacha, canPull, rollGacha, type PullResult } from '../../meta/gacha';
import { defaultSave, type SaveData } from '../../meta/save';
import { saveStore } from '../../meta/store';
import { GachaStage, type StagePhase } from './GachaStage';
import '../../components/Shell/Shell.css';
import './Gacha.css';

interface Props {
  save: SaveData;
  onNav: (s: Screen) => void;
  qa?: string;
}

const BANNER = ['wg_hayate', 'st_ouga', 'ls_kou'];

interface Stage {
  nonce: number;
  results: PullResult[];
  count: 1 | 10;
  hold?: StagePhase;
  holdIndex?: number;
}

/** 抽選して保存する。演出より前に済ませる。 */
function pull(count: 1 | 10, seed: number): PullResult[] | null {
  const cur = saveStore.get();
  if (!canPull(cur, count)) return null;
  const ids = rollGacha(createRng(seed), count);
  const { save: next, results } = applyGacha(cur, ids, count === 1 ? META.gacha.cost1 : META.gacha.cost10);
  saveStore.update(() => next);
  return results;
}

let qaStage: Stage | null | undefined;
let nonceSeq = 0;

function initialStage(qa?: string): Stage | null {
  if (!import.meta.env.DEV || !qa) return null;
  if (qaStage !== undefined) return qaStage;
  qaStage = buildQaStage(qa);
  return qaStage;
}

function buildQaStage(qa?: string): Stage | null {
  // DEV only (App ignores qa in production). Uses a throwaway in-memory save: saveStore is never touched.
  if (qa !== 'ball' && qa !== 'cut' && qa !== 'card' && qa !== 'result') return null;
  const { results } = applyGacha(defaultSave(), rollGacha(createRng(7), 10), META.gacha.cost10);
  const at = (rarity: number, fallback: number): number => {
    const i = results.findIndex((r) => r.rarity === rarity);
    return i >= 0 ? i : fallback;
  };
  if (qa === 'card') return { nonce: ++nonceSeq, results, count: 10, hold: 'card', holdIndex: at(4, 1) };
  if (qa === 'cut') return { nonce: ++nonceSeq, results, count: 10, hold: 'card', holdIndex: at(5, 0) };
  return { nonce: ++nonceSeq, results, count: 10, hold: qa === 'ball' ? 'ball' : 'result' };
}

export function GachaScreen({ save, onNav, qa }: Props) {
  const [stage, setStage] = useState<Stage | null>(() => initialStage(qa));
  const [rates, setRates] = useState(qa === 'rates');
  const can1 = canPull(save, 1);
  const can10 = canPull(save, 10);

  const start = (count: 1 | 10) => {
    const results = pull(count, randomSeed() ^ Date.now());
    if (results) setStage({ nonce: ++nonceSeq, results, count });
  };

  return (
    <div className="scr gacha" data-testid="gacha-screen">
      <div className="scr__bg a-stage a-halftone" />
      <TopBar title="スカウト" sub="SCOUT" coins={save.coins} />
      <div className="scr__main gacha__main">
        <section className="gacha__banner">
          <div className="gacha__rays"><SpeedLines /></div>
          {BANNER.map((id, i) => {
            const { profile, team } = charaInfo(id);
            return (
              <div key={id} className={`gacha__b gacha__b--${i}`}><CharaBust look={profile.look} team={team} /></div>
            );
          })}
          <div className="gacha__sign">
            <span className="a-tag">★5 は全 5 人</span>
            <span className="a-head a-head--lg gacha__signtitle">選手スカウト</span>
          </div>
        </section>
        <div className="gacha__btns">
          <button type="button" className="a-btn a-btn--blue a-btn--block gacha__pull" disabled={!can1} onClick={() => start(1)} data-testid="gacha-pull-1">
            <span>1 回 <b className="a-num gacha__cost">{META.gacha.cost1}</b></span>
          </button>
          <button type="button" className="a-btn a-btn--yellow a-btn--block gacha__pull gacha__pull--10" disabled={!can10} onClick={() => start(10)} data-testid="gacha-pull-10">
            <span className="gacha__p10">
              <span>10 連 <b className="a-num gacha__cost">{META.gacha.cost10}</b></span>
              <em>★4 以上 1 人確定</em>
            </span>
          </button>
        </div>
        {(!can1 || !can10) && <p className="gacha__short" data-testid="gacha-short">コインが足りません。試合の報酬でコインが増えます</p>}
        <button type="button" className="gacha__ratesbtn" onClick={() => setRates(true)} data-testid="gacha-rates">提供割合を見る</button>
        <p className="gacha__notice" data-testid="gacha-notice">コインはゲーム内で手に入るものだけ。購入はありません</p>
      </div>
      <BottomNav current="gacha" onNav={onNav} />
      {rates && <RatesSheet onClose={() => setRates(false)} />}
      {stage && (
        <GachaStage
          key={stage.nonce}
          results={stage.results}
          hold={stage.hold}
          holdIndex={stage.holdIndex}
          canAgain={canPull(save, stage.count)}
          onClose={() => setStage(null)}
          onAgain={() => start(stage.count)}
        />
      )}
    </div>
  );
}
