import type { RoleId, Stats } from '../../game/types';
import { STAT_LABEL, STAT_ORDER, baseStats } from './chara';
import './Shell.css';

/** 能力 8 項目。原型（同じロール）より高い分は黄色で「+n」。 */
export function StatBars({ stats, role }: { stats: Stats; role: RoleId }) {
  const base = baseStats(role);
  return (
    <ul className="sbars">
      {STAT_ORDER.map((k) => {
        const plus = stats[k] - base[k];
        return (
          <li key={k} className="sbars__row">
            <span className="sbars__label">{STAT_LABEL[k]}</span>
            <b className={`a-num sbars__val${plus > 0 ? ' is-up' : ''}`}>{stats[k]}</b>
            {plus > 0 && <em className="a-num sbars__plus">+{plus}</em>}
            <span className="sbars__bar">
              <i style={{ width: `${Math.min(100, base[k])}%` }} />
              {plus > 0 && <i className="is-plus" style={{ width: `${Math.min(100 - base[k], plus)}%` }} />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
