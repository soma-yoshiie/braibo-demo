import type { CSSProperties } from 'react';
import { BallG, CharaBust, CharaBustG, CharaMedal, CharaMedalG, Crest, PosTag, SpeedLines, Starburst, Stars, TypeChip, TypeMark } from '../components/Chara';
import type { Position, TypeId } from '../game/types';
import type { CharaLook, Expression, TeamId } from '../components/Chara';
import './CharaGallery.css';

interface Entry {
  id: string;
  role: string;
  rarity: 3 | 4 | 5;
  name: string;
  title: string;
  number: number;
  look: CharaLook;
}

// DESIGN.md §12.1 の表の写し（見た目のみ）。
export const GALLERY_LOOKS: Entry[] = [
  { id: 'st_kakeru', role: 'ST', rarity: 3, name: '天宮カケル', title: '一直線のエース', number: 9, look: { hair: 'spiky', hairColor: '#2456d6', hairHi: '#86a2e8', skin: 'fair', eyes: 'sharp', eyeColor: '#2a7bff', extra: 'none' } },
  { id: 'st_raiga', role: 'ST', rarity: 4, name: '雷堂ライガ', title: '雷鳴のストライカー', number: 11, look: { hair: 'mohawk', hairColor: '#f2c21b', hairHi: '#f7dd81', skin: 'tan', eyes: 'sharp', eyeColor: '#ff8a00', extra: 'scar' } },
  { id: 'st_ouga', role: 'ST', rarity: 5, name: '皇オウガ', title: '絶対王者', number: 10, look: { hair: 'slick', hairColor: '#e9e4f5', hairHi: '#f2f0f9', skin: 'fair', eyes: 'narrow', eyeColor: '#c9a227', extra: 'none' } },
  { id: 'wg_sora', role: 'WG', rarity: 3, name: '風間ソラ', title: '疾風のサイドアタッカー', number: 7, look: { hair: 'windswept', hairColor: '#1f9ad6', hairHi: '#83c7e8', skin: 'fair', eyes: 'round', eyeColor: '#1f9ad6', extra: 'none' } },
  { id: 'wg_tsubame', role: 'WG', rarity: 4, name: '鳥居ツバメ', title: '燕返しのクロッサー', number: 17, look: { hair: 'ponytail', hairColor: '#24304f', hairHi: '#868d9e', skin: 'fair', eyes: 'sharp', eyeColor: '#7c5cff', extra: 'none' } },
  { id: 'wg_hayate', role: 'WG', rarity: 5, name: '天羽ハヤテ', title: '影を置き去る翼', number: 14, look: { hair: 'long', hairColor: '#35d0a5', hairHi: '#8fe5cd', skin: 'tan', eyes: 'narrow', eyeColor: '#19b38a', extra: 'headband' } },
  { id: 'ls_taiga', role: 'LS', rarity: 3, name: '岩城タイガ', title: '遠距離砲', number: 18, look: { hair: 'bowl', hairColor: '#3b4a7a', hairHi: '#939bb5', skin: 'fair', eyes: 'round', eyeColor: '#3b4a7a', extra: 'glasses' } },
  { id: 'ls_iori', role: 'LS', rarity: 4, name: '鷹見イオリ', title: '鷹の目スナイパー', number: 8, look: { hair: 'swept', hairColor: '#8a5a2b', hairHi: '#bea48a', skin: 'tan', eyes: 'narrow', eyeColor: '#b9772f', extra: 'none' } },
  { id: 'ls_kou', role: 'LS', rarity: 5, name: '星乃コウ', title: '流星キャノン', number: 20, look: { hair: 'curly', hairColor: '#ff7ab8', hairHi: '#ffb5d7', skin: 'fair', eyes: 'round', eyeColor: '#ff4f9a', extra: 'none' } },
  { id: 'ic_shinobu', role: 'IC', rarity: 3, name: '霧島シノブ', title: '読みの番人', number: 6, look: { hair: 'swept', hairColor: '#4b3fae', hairHi: '#9c95d2', skin: 'fair', eyes: 'stern', eyeColor: '#6a5cff', extra: 'none' } },
  { id: 'ic_jin', role: 'IC', rarity: 4, name: '夜鷹ジン', title: 'パスコースの狩人', number: 5, look: { hair: 'crop', hairColor: '#1b1d2b', hairHi: '#81828a', skin: 'brown', eyes: 'stern', eyeColor: '#d83a3a', extra: 'bandage' } },
  { id: 'ic_rei', role: 'IC', rarity: 5, name: '白瀬レイ', title: '先読みの氷刃', number: 16, look: { hair: 'long', hairColor: '#cfe9ff', hairHi: '#e4f2ff', skin: 'fair', eyes: 'narrow', eyeColor: '#58b8ff', extra: 'none' } },
  { id: 'df_daigo', role: 'DF', rarity: 3, name: '鉄山ダイゴ', title: '不動の壁', number: 4, look: { hair: 'crop', hairColor: '#2b3550', hairHi: '#8a8f9e', skin: 'tan', eyes: 'stern', eyeColor: '#2b3550', extra: 'headband' } },
  { id: 'df_gou', role: 'DF', rarity: 4, name: '熊谷ゴウ', title: '空中戦の番長', number: 3, look: { hair: 'mohawk', hairColor: '#7a3b1e', hairHi: '#b59383', skin: 'brown', eyes: 'stern', eyeColor: '#a34a1a', extra: 'none' } },
  { id: 'df_genbu', role: 'DF', rarity: 5, name: '城戸ゲンブ', title: '難攻不落の城', number: 2, look: { hair: 'slick', hairColor: '#1f6f5c', hairHi: '#83afa5', skin: 'tan', eyes: 'stern', eyeColor: '#2bb38f', extra: 'scar' } },
  { id: 'rv_enji', role: 'ST', rarity: 3, name: '火野エンジ', title: '紅蓮の点取り屋', number: 9, look: { hair: 'spiky', hairColor: '#c8102e', hairHi: '#e07b8c', skin: 'fair', eyes: 'sharp', eyeColor: '#ff3b3b', extra: 'none' } },
  { id: 'rv_homura', role: 'WG', rarity: 3, name: '朱堂ホムラ', title: '火走りのウイング', number: 7, look: { hair: 'windswept', hairColor: '#e2562a', hairHi: '#efa289', skin: 'tan', eyes: 'round', eyeColor: '#ff6a2a', extra: 'none' } },
  { id: 'rv_kagari', role: 'LS', rarity: 3, name: '焔カガリ', title: '灼熱の砲手', number: 10, look: { hair: 'bowl', hairColor: '#8f1d2c', hairHi: '#c1828a', skin: 'fair', eyes: 'round', eyeColor: '#8f1d2c', extra: 'glasses' } },
  { id: 'rv_ren', role: 'IC', rarity: 3, name: '赤城レン', title: '焦がす読み', number: 6, look: { hair: 'swept', hairColor: '#b3261e', hairHi: '#d58783', skin: 'fair', eyes: 'stern', eyeColor: '#ff5a3c', extra: 'none' } },
  { id: 'rv_gantetsu', role: 'DF', rarity: 3, name: '不破ガンテツ', title: '燃える鉄壁', number: 4, look: { hair: 'crop', hairColor: '#5a1418', hairHi: '#a47d7f', skin: 'brown', eyes: 'stern', eyeColor: '#b81224', extra: 'headband' } },
];

const EXPRS: Expression[] = ['normal', 'win', 'lose'];
const TEAMS: TeamId[] = ['blue', 'red'];

function Card({ e }: { e: Entry }) {
  return (
    <section className="cg-card">
      <h3>
        {e.name} <small>{e.title}</small>
        <span className="cg-id">{e.id} / {e.look.hair} / {e.look.eyes} / {e.look.extra} / {e.look.skin}</span>
      </h3>
      <div className="cg-row">
        {TEAMS.flatMap((t) => EXPRS.map((x) => (
          <div key={t + x} className="cg-bust cg-bg"><CharaBust look={e.look} team={t} expression={x} /></div>
        )))}
      </div>
      <div className="cg-row cg-medals">
        {TEAMS.map((t) => (
          <div key={t} className="cg-medalset">
            {[96, 48, 36].map((px) => (
              <div key={px} style={{ width: px, height: (px * 118) / 112 }}>
                <CharaMedal look={e.look} team={t} number={e.number} abbr={e.role} rarity={e.rarity} tag={e.rarity === 3 ? 'Lv.3' : e.rarity === 4 ? '+4' : undefined} />
              </div>
            ))}
            <svg width="36" height="38" viewBox="0 0 112 118" className="cg-g"><g transform="translate(6 6)"><CharaMedalG look={e.look} team={t} number={e.number} abbr={e.role} rarity={e.rarity} tag={e.rarity === 3 ? 'Lv.3' : e.rarity === 4 ? '+4' : undefined} /></g></svg>
          </div>
        ))}
      </div>
    </section>
  );
}

const TYPES: TypeId[] = ['physical', 'speed', 'technical', 'support', 'playmaker'];
const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW'];

function V09() {
  const look = GALLERY_LOOKS[0].look;
  const look2 = GALLERY_LOOKS[6].look;
  return (
    <section className="cg-card cg-misc">
      <h3>v0.9: TypeMark / TypeChip / PosTag / keeper / medal type</h3>
      <div className="cg-row">
        {[12, 16, 24, 40].map((px) => (
          <div key={px} className="cg-row">
            {TYPES.map((t) => <TypeMark key={t} type={t} size={px} />)}
          </div>
        ))}
      </div>
      <div className="cg-row" style={{ marginTop: 8 }}>
        {TYPES.map((t) => <TypeChip key={t} type={t} />)}
        {POSITIONS.map((p) => <PosTag key={p} position={p} />)}
      </div>
      <div className="cg-row" style={{ marginTop: 8 }}>
        {TEAMS.map((t) => (
          <div key={t} className="cg-row">
            <div className="cg-bust cg-bg"><CharaBust look={look2} team={t} keeper /></div>
            <div className="cg-bust cg-bg"><CharaBust look={look2} team={t} keeper expression="lose" /></div>
            {[96, 48, 36].map((px) => (
              <div key={px} style={{ width: px, height: (px * 118) / 112 }}>
                <CharaMedal look={look2} team={t} number={1} abbr="GK" keeper type="support" />
              </div>
            ))}
            <svg width="48" height="50" viewBox="-6 -6 112 118" className="cg-g"><CharaMedalG look={look2} team={t} number={1} abbr="GK" keeper /></svg>
            <svg width="82" height="82" viewBox="0 0 100 100" className="cg-bg"><CharaBustG look={look} team={t} keeper /></svg>
          </div>
        ))}
      </div>
      <div className="cg-row cg-medals" style={{ marginTop: 8 }}>
        {TYPES.flatMap((ty) => ['blue', 'red'].map((t) => (
          <div key={ty + t} className="cg-medalset">
            {[96, 48, 36].map((px) => (
              <div key={px} style={{ width: px, height: (px * 118) / 112 }}>
                <CharaMedal look={look} team={t as 'blue' | 'red'} number={9} abbr="FW" type={ty} rarity={4} />
              </div>
            ))}
          </div>
        )))}
      </div>
    </section>
  );
}

const box: CSSProperties = { width: 120, height: 120 };

function Misc() {
  return (
    <section className="cg-card cg-misc">
      <h3>Stars / Crest / SpeedLines / Starburst / BallG / Medal ball</h3>
      <div className="cg-row">
        {[3, 4, 5].map((n) => <Stars key={n} rarity={n} size={22} />)}
        <Crest team="blue" size={48} /><Crest team="red" size={48} />
        <div style={{ ...box, background: '#2a4fb8' }}><SpeedLines /></div>
        <div style={{ width: 120, height: 90 }}><Starburst /></div>
        <div style={{ width: 90, height: 90 }}><Starburst points={9} fill="#ff3b3b" /></div>
        <svg width="80" height="80" viewBox="-20 -20 40 40" className="cg-bg"><BallG r={16} /></svg>
        <svg width="36" height="36" viewBox="-20 -20 40 40" className="cg-bg"><BallG r={14} /></svg>
        <div style={{ width: 120, height: 126 }}>
          <CharaMedal look={GALLERY_LOOKS[0].look} team="blue" number={9} abbr="ST" rarity={3} ball />
        </div>
      </div>
    </section>
  );
}

export function CharaGallery({ only, misc = true }: { only?: [number, number]; misc?: boolean }) {
  const list = only ? GALLERY_LOOKS.slice(only[0], only[1]) : GALLERY_LOOKS;
  return (
    <div className="cg-page">
      <h2>CHARA GALLERY</h2>
      <div className="cg-grid">
        {list.map((e) => <Card key={e.id} e={e} />)}
      </div>
      {misc && <Misc />}
      {misc && <V09 />}
    </div>
  );
}

export default CharaGallery;
