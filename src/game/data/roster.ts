import type { RoleId, Stats } from '../types';

/**
 * Named roster (DESIGN.md §12.1). Types only are imported so that characters.ts can import this file
 * without a cycle. Names and looks are provisional, original designs.
 */
export type Rarity = 3 | 4 | 5;
export type HairId = 'spiky' | 'windswept' | 'bowl' | 'swept' | 'crop' | 'long' | 'ponytail' | 'mohawk' | 'curly' | 'slick';
export type EyeId = 'sharp' | 'stern' | 'round' | 'narrow';
export type ExtraId = 'none' | 'headband' | 'glasses' | 'bandage' | 'scar';
export interface CharaLook {
  hair: HairId;
  hairColor: string;
  hairHi: string;
  skin: 'fair' | 'tan' | 'brown';
  eyes: EyeId;
  eyeColor: string;
  extra: ExtraId;
}
export interface CharaProfile {
  id: string;
  role: RoleId;
  name: string;
  title: string;
  rarity: Rarity;
  number: number;
  group: 'player' | 'rival';
  quotes: { duel: string; goal: string; lose: string };
  look: CharaLook;
  bonus: Partial<Stats>;
}

export const ROLE_ORDER: RoleId[] = ['striker', 'wing', 'longShooter', 'interceptor', 'physicalDefender'];

/** Archetype display names (mirrors CHARACTERS; kept here to avoid an import cycle). */
const ARCHETYPE_NAME: Record<RoleId, string> = {
  striker: 'ストライカー',
  wing: 'ウイング',
  longShooter: 'ロングシューター',
  interceptor: 'インターセプター',
  physicalDefender: 'フィジカルDF',
};

/** Lighten a #rrggbb colour by mixing it toward white. */
function tint(hex: string, amount = 0.38): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number): string => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

type Row = Omit<CharaProfile, 'look'> & { look: Omit<CharaLook, 'hairHi'> };

const ROWS: Row[] = [
  {
    id: 'st_kakeru', role: 'striker', name: '天宮カケル', title: '一直線のエース', rarity: 3, number: 9, group: 'player',
    quotes: { duel: 'まっすぐ行くだけだ', goal: 'よし、一直線で決めた', lose: '次は止められない' },
    look: { hair: 'spiky', hairColor: '#2456d6', skin: 'fair', eyes: 'sharp', eyeColor: '#2a7bff', extra: 'none' }, bonus: {},
  },
  {
    id: 'st_raiga', role: 'striker', name: '雷堂ライガ', title: '雷鳴のストライカー', rarity: 4, number: 11, group: 'player',
    quotes: { duel: '雷より先に行く', goal: '轟け、ゴールの音', lose: 'ちっ、まだ鳴らす' },
    look: { hair: 'mohawk', hairColor: '#f2c21b', skin: 'tan', eyes: 'sharp', eyeColor: '#ff8a00', extra: 'scar' },
    bonus: { shoot: 5, physical: 5, aerial: 2 },
  },
  {
    id: 'st_ouga', role: 'striker', name: '皇オウガ', title: '絶対王者', rarity: 5, number: 10, group: 'player',
    quotes: { duel: '道を空けろ', goal: '王の座は動かない', lose: '覚えておこう' },
    look: { hair: 'slick', hairColor: '#e9e4f5', skin: 'fair', eyes: 'narrow', eyeColor: '#c9a227', extra: 'none' },
    bonus: { shoot: 9, aerial: 9, physical: 4, longShot: 4 },
  },
  {
    id: 'wg_sora', role: 'wing', name: '風間ソラ', title: '疾風のサイドアタッカー', rarity: 3, number: 7, group: 'player',
    quotes: { duel: '風は止められない', goal: '空まで届いたぜ', lose: 'もう一度走る' },
    look: { hair: 'windswept', hairColor: '#1f9ad6', skin: 'fair', eyes: 'round', eyeColor: '#1f9ad6', extra: 'none' }, bonus: {},
  },
  {
    id: 'wg_tsubame', role: 'wing', name: '鳥居ツバメ', title: '燕返しのクロッサー', rarity: 4, number: 17, group: 'player',
    quotes: { duel: '身を翻して抜く', goal: '狙いどおりの弧だ', lose: '軌道を修正する' },
    look: { hair: 'ponytail', hairColor: '#24304f', skin: 'fair', eyes: 'sharp', eyeColor: '#7c5cff', extra: 'none' },
    bonus: { cross: 5, pass: 5, shoot: 2 },
  },
  {
    id: 'wg_hayate', role: 'wing', name: '天羽ハヤテ', title: '影を置き去る翼', rarity: 5, number: 14, group: 'player',
    quotes: { duel: '影も追いつけない', goal: '置き去りにしたよ', lose: '影が少し遅れた' },
    look: { hair: 'long', hairColor: '#35d0a5', skin: 'tan', eyes: 'narrow', eyeColor: '#19b38a', extra: 'headband' },
    bonus: { cross: 9, pass: 9, shoot: 4, intercept: 4 },
  },
  {
    id: 'ls_taiga', role: 'longShooter', name: '岩城タイガ', title: '遠距離砲', rarity: 3, number: 18, group: 'player',
    quotes: { duel: '距離は問題ない', goal: 'ここからで十分だ', lose: '角度を測り直す' },
    look: { hair: 'bowl', hairColor: '#3b4a7a', skin: 'fair', eyes: 'round', eyeColor: '#3b4a7a', extra: 'glasses' }, bonus: {},
  },
  {
    id: 'ls_iori', role: 'longShooter', name: '鷹見イオリ', title: '鷹の目スナイパー', rarity: 4, number: 8, group: 'player',
    quotes: { duel: '見えているよ', goal: '一点を射抜いた', lose: '目測がずれたか' },
    look: { hair: 'swept', hairColor: '#8a5a2b', skin: 'tan', eyes: 'narrow', eyeColor: '#b9772f', extra: 'none' },
    bonus: { longShot: 5, pass: 5, shoot: 2 },
  },
  {
    id: 'ls_kou', role: 'longShooter', name: '星乃コウ', title: '流星キャノン', rarity: 5, number: 20, group: 'player',
    quotes: { duel: '星を落とすよ', goal: '流れ星、見えた？', lose: '光はまだ消えない' },
    look: { hair: 'curly', hairColor: '#ff7ab8', skin: 'fair', eyes: 'round', eyeColor: '#ff4f9a', extra: 'none' },
    bonus: { longShot: 8, shoot: 9, pass: 4, physical: 4 },
  },
  {
    id: 'ic_shinobu', role: 'interceptor', name: '霧島シノブ', title: '読みの番人', rarity: 3, number: 6, group: 'player',
    quotes: { duel: '読み通りだな', goal: '静かに仕留めた', lose: '読み違えたか' },
    look: { hair: 'swept', hairColor: '#4b3fae', skin: 'fair', eyes: 'stern', eyeColor: '#6a5cff', extra: 'none' }, bonus: {},
  },
  {
    id: 'ic_jin', role: 'interceptor', name: '夜鷹ジン', title: 'パスコースの狩人', rarity: 4, number: 5, group: 'player',
    quotes: { duel: '獲物は逃がさない', goal: '狩りの仕上げだ', lose: '次の獲物を探す' },
    look: { hair: 'crop', hairColor: '#1b1d2b', skin: 'brown', eyes: 'stern', eyeColor: '#d83a3a', extra: 'bandage' },
    bonus: { intercept: 5, physical: 5, pass: 2 },
  },
  {
    id: 'ic_rei', role: 'interceptor', name: '白瀬レイ', title: '先読みの氷刃', rarity: 5, number: 16, group: 'player',
    quotes: { duel: 'もう切っておいた', goal: '冷たく決める', lose: '氷にもヒビは入る' },
    look: { hair: 'long', hairColor: '#cfe9ff', skin: 'fair', eyes: 'narrow', eyeColor: '#58b8ff', extra: 'none' },
    bonus: { intercept: 8, pass: 9, physical: 4, block: 4 },
  },
  {
    id: 'df_daigo', role: 'physicalDefender', name: '鉄山ダイゴ', title: '不動の壁', rarity: 3, number: 4, group: 'player',
    quotes: { duel: 'ここは通さん', goal: '壁も前に出る', lose: '壁にも傷はつく' },
    look: { hair: 'crop', hairColor: '#2b3550', skin: 'tan', eyes: 'stern', eyeColor: '#2b3550', extra: 'headband' }, bonus: {},
  },
  {
    id: 'df_gou', role: 'physicalDefender', name: '熊谷ゴウ', title: '空中戦の番長', rarity: 4, number: 3, group: 'player',
    quotes: { duel: '空は俺の縄張りだ', goal: '頭で決めてやった', lose: '次は高く跳ぶ' },
    look: { hair: 'mohawk', hairColor: '#7a3b1e', skin: 'brown', eyes: 'stern', eyeColor: '#a34a1a', extra: 'none' },
    bonus: { aerial: 5, physical: 5, block: 2 },
  },
  {
    id: 'df_genbu', role: 'physicalDefender', name: '城戸ゲンブ', title: '難攻不落の城', rarity: 5, number: 2, group: 'player',
    quotes: { duel: '城門は開かない', goal: '城主が自ら出た', lose: '城はまだ落ちぬ' },
    look: { hair: 'slick', hairColor: '#1f6f5c', skin: 'tan', eyes: 'stern', eyeColor: '#2bb38f', extra: 'scar' },
    bonus: { block: 9, physical: 8, aerial: 4, intercept: 4 },
  },
  {
    id: 'rv_enji', role: 'striker', name: '火野エンジ', title: '紅蓮の点取り屋', rarity: 3, number: 9, group: 'rival',
    quotes: { duel: '燃やし尽くす', goal: '点は俺がもらった', lose: '火はまだ消えん' },
    look: { hair: 'spiky', hairColor: '#c8102e', skin: 'fair', eyes: 'sharp', eyeColor: '#ff3b3b', extra: 'none' }, bonus: {},
  },
  {
    id: 'rv_homura', role: 'wing', name: '朱堂ホムラ', title: '火走りのウイング', rarity: 3, number: 7, group: 'rival',
    quotes: { duel: '火の粉も追えない', goal: '走り抜けて点火', lose: '火種は残ってる' },
    look: { hair: 'windswept', hairColor: '#e2562a', skin: 'tan', eyes: 'round', eyeColor: '#ff6a2a', extra: 'none' }, bonus: {},
  },
  {
    id: 'rv_kagari', role: 'longShooter', name: '焔カガリ', title: '灼熱の砲手', rarity: 3, number: 10, group: 'rival',
    quotes: { duel: '熱で押し切る', goal: '灼けつく一撃だ', lose: '砲身が冷めたな' },
    look: { hair: 'bowl', hairColor: '#8f1d2c', skin: 'fair', eyes: 'round', eyeColor: '#8f1d2c', extra: 'glasses' }, bonus: {},
  },
  {
    id: 'rv_ren', role: 'interceptor', name: '赤城レン', title: '焦がす読み', rarity: 3, number: 6, group: 'rival',
    quotes: { duel: '先に焦がしておく', goal: 'ほら、読み通り', lose: '読みが焦げたか' },
    look: { hair: 'swept', hairColor: '#b3261e', skin: 'fair', eyes: 'stern', eyeColor: '#ff5a3c', extra: 'none' }, bonus: {},
  },
  {
    id: 'rv_gantetsu', role: 'physicalDefender', name: '不破ガンテツ', title: '燃える鉄壁', rarity: 3, number: 4, group: 'rival',
    quotes: { duel: '燃える鉄は折れぬ', goal: '鉄が前線で燃えた', lose: '焼き入れが足りん' },
    look: { hair: 'crop', hairColor: '#5a1418', skin: 'brown', eyes: 'stern', eyeColor: '#b81224', extra: 'headband' }, bonus: {},
  },
];

export const ROSTER: CharaProfile[] = ROWS.map((r) => ({ ...r, look: { ...r.look, hairHi: tint(r.look.hairColor) } }));

const BY_ID = new Map(ROSTER.map((p) => [p.id, p]));

export const STARTER_IDS: Record<RoleId, string> = {
  striker: 'st_kakeru',
  wing: 'wg_sora',
  longShooter: 'ls_taiga',
  interceptor: 'ic_shinobu',
  physicalDefender: 'df_daigo',
};

/** Slot order = DEFAULT_FORMATION (ST, WG, LS, IC, DF). */
export const RIVAL_LINEUP: string[] = ['rv_enji', 'rv_homura', 'rv_kagari', 'rv_ren', 'rv_gantetsu'];

export const SCOUT_POOL: CharaProfile[] = ROSTER.filter((p) => p.group === 'player');

/** Max `+n` strengthening suffix (DESIGN.md §13.1). */
export const MAX_PLUS = 20;

/** Splits `base+n` into its parts. No suffix = plus 0. Throws on an invalid suffix (0, > MAX_PLUS, non-integer). */
export function splitCharId(id: string): { base: string; plus: number } {
  const i = id.lastIndexOf('+');
  if (i < 0) return { base: id, plus: 0 };
  const suffix = id.slice(i + 1);
  const plus = /^[0-9]+$/.test(suffix) ? Number(suffix) : NaN;
  if (i === 0 || !Number.isInteger(plus) || plus < 1 || plus > MAX_PLUS) throw new Error(`Unknown character: ${id}`);
  return { base: id.slice(0, i), plus };
}

/** `base+n`, or `base` when n is 0. */
export function withPlus(base: string, n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_PLUS) throw new Error(`Invalid plus: ${n}`);
  return n === 0 ? base : `${base}+${n}`;
}

/** Roster profile (`x+n` allowed), or for an archetype id a default profile borrowing the role's ★3 starter look. */
export function getProfile(charId: string): CharaProfile {
  const { base, plus } = splitCharId(charId);
  const p = BY_ID.get(base);
  if (p) return plus ? { ...p, id: charId } : p;
  const role = ROLE_ORDER.find((r) => r === base);
  if (!role) throw new Error(`Unknown character: ${charId}`);
  const starter = BY_ID.get(STARTER_IDS[role]);
  if (!starter) throw new Error(`Missing starter for ${role}`);
  return { ...starter, id: charId, name: ARCHETYPE_NAME[role] };
}
