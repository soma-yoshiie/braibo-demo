import { RIVAL_LINEUP, withPlus } from '../game/data/roster';
import type { SaveData } from './save';

export interface StageDef {
  id: string;
  no: number;
  name: string;
  note: string;
  plus: number;
  stars: 1 | 2 | 3 | 4 | 5;
  firstClear: number;
  /** Multiplier on the match reward coins (rounded). Exp is not multiplied. */
  rewardMul: number;
}

export const STAGES: StageDef[] = [
  { id: 's1', no: 1, name: '練習試合', note: 'まずは 1 勝', plus: 0, stars: 1, firstClear: 300, rewardMul: 1.0 },
  { id: 's2', no: 2, name: '地区予選', note: '相手が少し手強い', plus: 1, stars: 2, firstClear: 400, rewardMul: 1.2 },
  { id: 's3', no: 3, name: '地区決勝', note: '相手の能力が上がる', plus: 3, stars: 3, firstClear: 600, rewardMul: 1.4 },
  { id: 's4', no: 4, name: '全国大会', note: '強化して挑みたい', plus: 5, stars: 4, firstClear: 800, rewardMul: 1.7 },
  { id: 's5', no: 5, name: '紅蓮・本気', note: '相手の全力', plus: 7, stars: 5, firstClear: 1200, rewardMul: 2.0 },
];

export function getStage(stageId: string): StageDef | undefined {
  return STAGES.find((s) => s.id === stageId);
}

/** The rival lineup with the stage's strengthening applied (slot order). */
export function stageLineup(stage: StageDef): string[] {
  return RIVAL_LINEUP.map((id) => withPlus(id, stage.plus));
}

export function isUnlocked(save: SaveData, stageId: string): boolean {
  const i = STAGES.findIndex((s) => s.id === stageId);
  if (i < 0) return false;
  if (i === 0) return true;
  return save.stages[STAGES[i - 1].id]?.cleared === true;
}

/** First stage not yet cleared (the last one when all are cleared). */
export function nextStage(save: SaveData): StageDef {
  return STAGES.find((s) => !save.stages[s.id]?.cleared) ?? STAGES[STAGES.length - 1];
}
