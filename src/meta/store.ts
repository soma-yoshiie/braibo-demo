import { useSyncExternalStore } from 'react';
import { defaultSave, parseSave, rolloverDaily, type SaveData } from './save';

const KEY = 'braibo.save.v1';

/** Local date as YYYY-MM-DD. The only place in src/meta that reads the clock. */
export function todayString(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function readStorage(): unknown {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const txt = localStorage.getItem(KEY);
    return txt ? JSON.parse(txt) : undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(data: SaveData): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* memory only */
  }
}

let current: SaveData | undefined;
const listeners = new Set<() => void>();

function load(): SaveData {
  return rolloverDaily(parseSave(readStorage()), todayString());
}

function get(): SaveData {
  if (!current) current = load();
  return current;
}

function notify(): void {
  listeners.forEach((cb) => cb());
}

/** Re-reads storage (another tab may have written). Returns true when the in-memory save changed. */
function refresh(): boolean {
  if (readStorage() === undefined) return false;
  const next = load();
  if (current && JSON.stringify(next) === JSON.stringify(current)) return false;
  current = next;
  return true;
}

function set(next: SaveData): void {
  current = next;
  writeStorage(next);
  notify();
}

export const saveStore = {
  get,
  update(fn: (s: SaveData) => SaveData): void {
    const changed = refresh();
    const before = get();
    const next = fn(before);
    if (next !== before) set(next);
    else if (changed) notify();
  },
  reset(): void {
    set(defaultSave());
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === null || e.key === KEY) {
        if (refresh()) notify();
      }
    });
  }
} catch {
  /* not a browser */
}

export function useSave(): [SaveData, (fn: (s: SaveData) => SaveData) => void] {
  const save = useSyncExternalStore(saveStore.subscribe, saveStore.get, saveStore.get);
  return [save, saveStore.update];
}
