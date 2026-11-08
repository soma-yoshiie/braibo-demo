import type { SkillId, Stats } from '../types';
import { RULES } from './config';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const has = (skills: readonly SkillId[], s: SkillId) => skills.includes(s);

export function duelWinProbability(statA: number, statB: number, opts: { carrierIsA?: boolean } = {}): number {
  const r = RULES.duel;
  const bonus = opts.carrierIsA === undefined ? 0 : opts.carrierIsA ? r.carrierBonus : -r.carrierBonus;
  return clamp(r.base + (statA - statB) / r.physicalDivisor + bonus, r.min, r.max);
}

export function passMaxDistance(skills: readonly SkillId[]): number {
  return RULES.pass.maxDistance + (has(skills, 'passMaster') ? RULES.skills.passMasterExtraDistance : 0);
}

export function passAccuracy(distance: number, passStat: number, skills: readonly SkillId[]): number {
  const r = RULES.pass;
  const bonus = has(skills, 'passMaster') ? RULES.skills.passMasterAccuracyBonus : 0;
  return clamp(
    r.base - r.falloffPerCell * Math.max(0, distance - 1) + (passStat - 50) / r.statDivisor + bonus,
    r.min,
    r.max,
  );
}

export function interceptProbability(interceptStat: number, offset: number): number {
  const r = RULES.pass.intercept;
  const onLine = r.onLineBonus * Math.max(0, 1 - offset / RULES.pass.laneWidth);
  return clamp(r.base + (interceptStat - 50) / r.statDivisor + onLine, r.min, r.max);
}

export function crossDelivery(distance: number, crossStat: number): number {
  const r = RULES.cross;
  return clamp(r.base - r.falloffPerCell * distance + (crossStat - 50) / r.statDivisor, r.min, r.max);
}

export function aerialWinProbability(
  aerialR: number,
  aerialD: number,
  skillsR: readonly SkillId[],
  skillsD: readonly SkillId[],
): number {
  const r = RULES.cross.aerial;
  let bonus = 0;
  if (has(skillsR, 'airBattler')) bonus += RULES.skills.airBattlerBonus;
  if (has(skillsD, 'airBattler')) bonus -= RULES.skills.airBattlerBonus;
  return clamp(r.base + (aerialR - aerialD) / r.statDivisor + bonus, r.min, r.max);
}

export function headerGoalProbability(distance: number, aerialStat: number): number {
  const r = RULES.cross.header;
  return clamp(r.base - r.falloffPerCell * distance + (aerialStat - 50) / r.statDivisor, r.min, r.max);
}

export function shotGoalProbability(
  distance: number,
  angleSin: number,
  stats: Stats,
  skills: readonly SkillId[],
  ctx: { oneTouchActive: boolean },
): number {
  const r = RULES.shot;
  let stat: number;
  if (distance <= r.nearRange) stat = stats.shoot;
  else if (distance >= r.nearRange + r.blendRange) stat = stats.longShot;
  else {
    const w = (distance - r.nearRange) / r.blendRange;
    stat = stats.shoot * (1 - w) + stats.longShot * w;
  }
  const bonus = ctx.oneTouchActive && has(skills, 'oneTouch') ? RULES.skills.oneTouchShotBonus : 0;
  const base = clamp(r.base - r.falloffPerCell * distance + (stat - 50) / r.statDivisor + bonus, r.min, r.max);
  return base * (1 - r.anglePenalty * angleSin);
}

export function blockProbability(
  distanceFromShooter: number,
  offset: number,
  blockStat: number,
  skills: readonly SkillId[],
): number {
  const r = RULES.shot.block;
  const bonus = has(skills, 'blockMaster') ? RULES.skills.blockMasterBonus : 0;
  return clamp(
    r.base -
      r.falloffPerCell * (distanceFromShooter - 1) +
      (blockStat - 50) / r.statDivisor -
      r.offLinePenalty * (offset / RULES.shot.laneWidth) +
      bonus,
    r.min,
    r.max,
  );
}
