import type { CharacterDef, RoleId } from '../types';

/**
 * Initial roster. Adding a character = adding an entry here.
 * Movement vectors are TEAM-RELATIVE: dy < 0 is forward.
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'striker',
    role: 'striker',
    name: 'ストライカー',
    abbr: 'ST',
    description: '前方へ最大2マス。近距離シュートが強いが守備は苦手。',
    moves: [
      { dx: 0, dy: -1, range: 2 }, // forward slide 2
      { dx: -1, dy: -1, range: 1 }, // diagonal forward
      { dx: 1, dy: -1, range: 1 },
      { dx: -1, dy: 0, range: 1 }, // sideways
      { dx: 1, dy: 0, range: 1 },
      { dx: 0, dy: 1, range: 1 }, // back
    ],
    stats: { physical: 55, aerial: 60, shoot: 85, longShot: 45, pass: 55, cross: 40, intercept: 35, block: 30 },
    skills: ['oneTouch'],
  },
  {
    id: 'wing',
    role: 'wing',
    name: 'ウイング',
    abbr: 'WG',
    description: '前後左右に広く動ける。クロスとパスが得意、競り合いは弱い。',
    moves: [
      { dx: 0, dy: -1, range: 2 },
      { dx: -1, dy: 0, range: 2 },
      { dx: 1, dy: 0, range: 2 },
      { dx: -1, dy: -1, range: 1 },
      { dx: 1, dy: -1, range: 1 },
      { dx: 0, dy: 1, range: 1 },
    ],
    stats: { physical: 40, aerial: 40, shoot: 55, longShot: 45, pass: 75, cross: 85, intercept: 45, block: 30 },
    skills: ['passMaster'],
  },
  {
    id: 'longShooter',
    role: 'longShooter',
    name: 'ロングシューター',
    abbr: 'LS',
    description: '移動は狭いが遠距離シュートの成功率が高い。',
    moves: [
      { dx: 0, dy: -1, range: 1 },
      { dx: 0, dy: 1, range: 1 },
      { dx: -1, dy: 0, range: 1 },
      { dx: 1, dy: 0, range: 1 },
      { dx: -1, dy: -1, range: 1 },
      { dx: 1, dy: -1, range: 1 },
    ],
    stats: { physical: 45, aerial: 45, shoot: 60, longShot: 90, pass: 65, cross: 50, intercept: 40, block: 35 },
    skills: [],
  },
  {
    id: 'interceptor',
    role: 'interceptor',
    name: 'インターセプター',
    abbr: 'IC',
    description: '斜めに素早く動きパスコースを遮断する。ボール奪取率が高い。',
    moves: [
      { dx: -1, dy: -1, range: 2 },
      { dx: 1, dy: -1, range: 2 },
      { dx: -1, dy: 1, range: 2 },
      { dx: 1, dy: 1, range: 2 },
      { dx: 0, dy: -1, range: 1 },
      { dx: 0, dy: 1, range: 1 },
    ],
    stats: { physical: 60, aerial: 55, shoot: 50, longShot: 45, pass: 65, cross: 50, intercept: 90, block: 55 },
    skills: ['counter'],
  },
  {
    id: 'physicalDefender',
    role: 'physicalDefender',
    name: 'フィジカルDF',
    abbr: 'DF',
    description: '移動は周囲1マス。競り合い・空中戦・ブロックが強い。',
    moves: [
      { dx: 0, dy: -1, range: 1 },
      { dx: 0, dy: 1, range: 1 },
      { dx: -1, dy: 0, range: 1 },
      { dx: 1, dy: 0, range: 1 },
      { dx: -1, dy: -1, range: 1 },
      { dx: 1, dy: -1, range: 1 },
      { dx: -1, dy: 1, range: 1 },
      { dx: 1, dy: 1, range: 1 },
    ],
    stats: { physical: 90, aerial: 85, shoot: 35, longShot: 30, pass: 50, cross: 35, intercept: 55, block: 85 },
    skills: ['blockMaster', 'airBattler'],
  },
];

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string): CharacterDef {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown character: ${id}`);
  return c;
}

export const ROLE_LABEL: Record<RoleId, string> = {
  striker: 'ストライカー',
  wing: 'ウイング',
  longShooter: 'ロングシューター',
  interceptor: 'インターセプター',
  physicalDefender: 'フィジカルDF',
};
