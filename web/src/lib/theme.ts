import { useSyncExternalStore } from 'react';
import { store } from './storage';

export type Theme = 'light' | 'dark';
const KEY = 'sadna-theme';
const listeners = new Set<() => void>();

export const getTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  store.set(KEY, t);
  listeners.forEach((f) => f());
}

/** Call once before the first render. */
export function initTheme() {
  document.documentElement.dataset.theme = store.get<Theme>(KEY, 'light');
}

export const useTheme = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => void listeners.delete(cb); }, getTheme);
