import { saveStore } from '../../meta/store';
import type { SaveSettings } from '../../meta/save';

export function patchSettings(patch: Partial<SaveSettings>): void {
  saveStore.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export type Screen = 'title' | 'home' | 'box' | 'team' | 'gacha' | 'match';
