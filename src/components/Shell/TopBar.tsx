import type { ReactNode } from 'react';
import './Shell.css';

export function Coins({ value }: { value: number }) {
  return (
    <div className="coins" data-testid="coins">
      <i className="coins__icon" aria-hidden="true" />
      <b className="a-num">{value.toLocaleString('ja-JP')}</b>
    </div>
  );
}

interface Props {
  title: string;
  sub?: string;
  coins: number;
  right?: ReactNode;
}

export function TopBar({ title, sub, coins, right }: Props) {
  return (
    <header className="topbar">
      <div className="topbar__title">
        <span className="a-head a-head--md">{title}</span>
        {sub && <span className="a-num topbar__sub">{sub}</span>}
      </div>
      <div className="topbar__right">
        <Coins value={coins} />
        {right}
      </div>
    </header>
  );
}
