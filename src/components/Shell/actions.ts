import { useEffect, useState } from 'react';
import { saveStore, todayString } from '../../meta/store';
import type { SaveSettings } from '../../meta/save';

export function patchSettings(patch: Partial<SaveSettings>): void {
  saveStore.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export type Screen = 'title' | 'home' | 'stage' | 'box' | 'team' | 'gacha' | 'mission' | 'match';

/** The one clock read lives in `src/meta/store.ts`. */
export { todayString } from '../../meta/store';

/** Today's date for rendering; re-read when the tab becomes visible again (an app left open past midnight catches up). */
export function useToday(): string {
  const [today, setToday] = useState(() => todayString());
  useEffect(() => {
    const refresh = () => setToday(todayString());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
