import type { LogLine } from '../viewTypes';
import './Overlays.css';

interface Props {
  lines: LogLine[];
  onClose: () => void;
}

export function LogDrawer({ lines, onClose }: Props) {
  // newest turn first; events inside a turn stay chronological
  const groups: { turn: number; items: LogLine[] }[] = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last && last.turn === l.turn) last.items.push(l);
    else groups.push({ turn: l.turn, items: [l] });
  }
  groups.reverse();
  return (
    <div className="overlay overlay--drawer" onClick={onClose} data-testid="log-drawer">
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <b>試合ログ</b>
          <button className="drawer__close" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        <div className="drawer__list">
          {groups.length === 0 && <div className="drawer__empty">まだログはありません</div>}
          {groups.map((g) => (
            <section key={g.turn} className="drawer__group">
              <h3 className="drawer__turn">ターン {g.turn}</h3>
              <ul>
                {g.items.map((l) => (
                  <li key={l.id}>{l.text}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
