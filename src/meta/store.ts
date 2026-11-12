import { useSyncExternalStore } from 'react';
import { defaultSave, parseSave, type SaveData } from './save';

const KEY = 'braibo.save.v1';

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

function get(): SaveData {
  if (!current) current = parseSave(readStorage());
  return current;
}

function set(next: SaveData): void {
  current = next;
  writeStorage(next);
  listeners.forEach((cb) => cb());
}

export const saveStore = {
  get,
  update(fn: (s: SaveData) => SaveData): void {
    const next = fn(get());
    if (next !== current) set(next);
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

export function useSave(): [SaveData, (fn: (s: SaveData) => SaveData) => void] {
  const save = useSyncExternalStore(saveStore.subscribe, saveStore.get, saveStore.get);
  return [save, saveStore.update];
}
