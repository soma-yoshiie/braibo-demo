import type { ReactNode } from 'react';
import './Shell.css';

interface Props {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
  closeTestId?: string;
  className?: string;
}

/** 中央のモーダル。背景を押すと閉じる。 */
export function Sheet({ title, onClose, children, testId, closeTestId, className = '' }: Props) {
  return (
    <>
      <div className="a-backdrop" onClick={onClose} />
      <div className={`a-sheet a-panel sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
        <button type="button" className="sheet__close" onClick={onClose} aria-label="閉じる" data-testid={closeTestId}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </button>
        {title && <h2 className="a-head a-head--lg sheet__title">{title}</h2>}
        {children}
      </div>
    </>
  );
}
