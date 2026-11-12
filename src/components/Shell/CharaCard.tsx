import { CharaBust, CharaMedal, Stars } from '../Chara';
import { charaInfo } from './chara';
import './Shell.css';

/** 顔アイコン（メダル）。親の大きさに合わせる。 */
export function Avatar({ id, ball }: { id: string; ball?: boolean }) {
  const { profile, abbr, team } = charaInfo(id);
  return <CharaMedal look={profile.look} team={team} number={profile.number} abbr={abbr} rarity={profile.rarity} ball={ball} />;
}

interface Props {
  id: string;
  owned: boolean;
  dup?: number;
  selected?: boolean;
  badge?: string;
  onClick?: () => void;
  testId?: string;
}

/** 選手ボックスと編成で使う札。持っていない選手は影と「？？？」。 */
export function CharaCard({ id, owned, dup = 0, selected, badge, onClick, testId }: Props) {
  const { profile, def, abbr } = charaInfo(id);
  return (
    <button
      type="button"
      className={`ccard ccard--r${profile.rarity}${owned ? '' : ' is-locked'}${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      disabled={!owned && !onClick}
      data-testid={testId}
    >
      <span className="ccard__role a-tag">{abbr}</span>
      {owned && dup > 0 && <span className="ccard__dup a-tag a-tag--dark">×{dup + 1}</span>}
      <span className="ccard__face">
        {owned ? (
          <Avatar id={id} />
        ) : (
          <span className="ccard__shadow">
            <CharaBust look={profile.look} team="blue" />
          </span>
        )}
      </span>
      <span className="ccard__stars">{owned ? <Stars rarity={profile.rarity} size={11} /> : <span className="a-num">★{profile.rarity}</span>}</span>
      <span className="ccard__name">{owned ? def.name : '？？？'}</span>
      {badge && <span className="ccard__badge a-tag">{badge}</span>}
    </button>
  );
}
