import { useEffect, useRef } from 'react';
import type { CharacterDef, Stats } from '../../game/types';
import './InfoSheet.css';

export interface InfoView {
  team: 'blue' | 'red';
  name: string;
  abbr: string;
  description: string;
  stats: Stats;
  role: CharacterDef['role'];
}

const ROLE_LABEL: Record<CharacterDef['role'], string> = {
  striker: 'ストライカー',
  wing: 'ウイング',
  longShooter: 'ロングシューター',
  interceptor: 'インターセプター',
  physicalDefender: 'フィジカルDF',
};

const STAT_ROWS: [keyof Stats, string][] = [
  ['physical', 'フィジカル'],
  ['aerial', '空中戦'],
  ['shoot', 'シュート'],
  ['longShot', 'ロングシュート'],
  ['pass', 'パス'],
  ['cross', 'クロス'],
  ['intercept', 'インターセプト'],
  ['block', 'ブロック'],
];

interface Props {
  info: InfoView;
  onClose: () => void;
}

export function InfoSheet({ info, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // tap outside closes (the tap still reaches whatever is underneath)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);
  return (
    <div className={`sheet sheet--${info.team}`} ref={ref} data-testid="info-sheet">
      <div className="sheet__head">
        <span className={`sheet__orb sheet__orb--${info.team}`}>{info.abbr}</span>
        <div className="sheet__title">
          <b>{info.name}</b>
          <span className="sheet__role">{ROLE_LABEL[info.role]}</span>
        </div>
        <button className="sheet__close" onClick={onClose} aria-label="閉じる" data-testid="info-close">
          ✕
        </button>
      </div>
      <p className="sheet__desc">{info.description}</p>
      <ul className="sheet__stats">
        {STAT_ROWS.map(([k, label]) => (
          <li key={k}>
            <span className="sheet__k">{label}</span>
            <span className="sheet__bar">
              <i style={{ width: `${Math.max(2, Math.min(100, info.stats[k]))}%` }} />
            </span>
            <span className="sheet__v">{info.stats[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
