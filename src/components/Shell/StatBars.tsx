import { getCharacter } from '../../game/data/characters';
import { getProfile } from '../../game/data/roster';
import { KEEPER_STAT_LABEL, STAT_LABEL, STAT_ORDER, baseStatsFor } from './chara';
import './Shell.css';

/**
 * 能力のバー。「+n」は「タイプの基本値＋ポジション補正」からの差（bonus と強化の分）。
 * keeper（省略時は選手のポジションが GK かどうか）のときはセーブ（block）とハイボール（aerial）だけを大きく出し、
 * ほかは「試合では使わない」として薄く出す。
 */
export function StatBars({ charId, keeper }: { charId: string; keeper?: boolean }) {
  const stats = getCharacter(charId).stats;
  const base = baseStatsFor(charId);
  const isKeeper = keeper ?? getProfile(charId).position === 'GK';
  const row = (k: (typeof STAT_ORDER)[number], label: string, big = false) => {
    const plus = stats[k] - base[k];
    return (
      <li key={k} className={`sbars__row${big ? ' is-big' : ''}`}>
        <span className="sbars__label">{label}</span>
        <b className={`a-num sbars__val${plus > 0 ? ' is-up' : ''}`}>{stats[k]}</b>
        {plus > 0 && <em className="a-num sbars__plus">+{plus}</em>}
        <span className="sbars__bar">
          <i style={{ width: `${Math.min(100, base[k])}%` }} />
          {plus > 0 && <i className="is-plus" style={{ width: `${Math.min(100 - base[k], plus)}%` }} />}
        </span>
      </li>
    );
  };
  if (isKeeper) {
    return (
      <div className="sbars-keeper">
        <ul className="sbars sbars--keeper">
          {row('block', KEEPER_STAT_LABEL.block, true)}
          {row('aerial', KEEPER_STAT_LABEL.aerial, true)}
        </ul>
        <p className="sbars__unused">
          試合では使わない：
          {STAT_ORDER.filter((k) => k !== 'block' && k !== 'aerial').map((k) => (
            <span key={k}>{STAT_LABEL[k]} <b className="a-num">{stats[k]}</b></span>
          ))}
        </p>
      </div>
    );
  }
  return <ul className="sbars">{STAT_ORDER.map((k) => row(k, STAT_LABEL[k]))}</ul>;
}
