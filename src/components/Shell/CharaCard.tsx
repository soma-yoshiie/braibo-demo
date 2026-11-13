import { CharaBust, CharaMedal } from '../Chara';
import { charaInfo } from './chara';
import './Shell.css';

/** 顔アイコン（メダル）。親の大きさに合わせる。tag は左下の小さな札（Lv.3 や +4）。 */
export function Avatar({ id, ball, tag }: { id: string; ball?: boolean; tag?: string }) {
  const { profile, abbr, team } = charaInfo(id);
  return <CharaMedal look={profile.look} team={team} number={profile.number} abbr={abbr} rarity={profile.rarity} tag={tag} ball={ball} />;
}

interface Props {
  id: string;
  owned: boolean;
  level: number;
  inLineup?: boolean;
  onClick?: () => void;
  testId?: string;
}

/** 選手ボックスの正方形アイコン。枠の色が ★（3 銀 / 4 金 / 5 虹）。持っていない選手は影。 */
export function CharaTile({ id, owned, level, inLineup, onClick, testId }: Props) {
  const { profile, abbr, def } = charaInfo(id);
  return (
    <button
      type="button"
      className={`ctile ctile--r${profile.rarity}${owned ? '' : ' is-locked'}`}
      onClick={onClick}
      disabled={!owned}
      data-testid={testId}
      aria-label={owned ? `${def.name} Lv.${level}` : '未所持'}
    >
      <span className="ctile__in">
        <span className="ctile__bust">
          <CharaBust look={profile.look} team="blue" />
        </span>
        <span className="ctile__role a-tag">{abbr}</span>
        {owned && inLineup && <span className="ctile__now a-tag a-tag--blue">編成中</span>}
        <span className="ctile__lv a-num">{owned ? `Lv.${level}` : `★${profile.rarity}`}</span>
      </span>
    </button>
  );
}
