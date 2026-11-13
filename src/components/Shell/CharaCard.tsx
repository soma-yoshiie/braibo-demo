import { CharaBust, CharaMedal, PosTag, TypeMark } from '../Chara';
import { charaInfo } from './chara';
import './Shell.css';

/** 顔アイコン（メダル）。親の大きさに合わせる。tag は左下の小さな札（Lv.3 や +4）。札の字はポジション、タイプの印つき。 */
export function Avatar({ id, ball, tag }: { id: string; ball?: boolean; tag?: string }) {
  const { profile, abbr, team, keeper } = charaInfo(id);
  return (
    <CharaMedal
      look={profile.look}
      team={team}
      number={profile.number}
      abbr={abbr}
      rarity={profile.rarity}
      tag={tag}
      type={profile.type}
      keeper={keeper}
      ball={ball}
    />
  );
}

interface Props {
  id: string;
  owned: boolean;
  level: number;
  inLineup?: boolean;
  onClick?: () => void;
  testId?: string;
}

/** 選手ボックスの正方形アイコン。枠の色が ★（3 銀 / 4 金 / 5 虹）。左上にポジション、左下にタイプの印。持っていない選手は影。 */
export function CharaTile({ id, owned, level, inLineup, onClick, testId }: Props) {
  const { profile, def, keeper } = charaInfo(id);
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
          <CharaBust look={profile.look} team="blue" keeper={keeper} />
        </span>
        <span className="ctile__pos"><PosTag position={profile.position} /></span>
        {owned && inLineup && <span className="ctile__now a-tag a-tag--blue">編成中</span>}
        <span className="ctile__type"><TypeMark type={profile.type} size={18} /></span>
        <span className="ctile__lv a-num">{owned ? `Lv.${level}` : `★${profile.rarity}`}</span>
      </span>
    </button>
  );
}
