import { useSyncExternalStore } from 'react';

declare global {
  interface Window {
    /**
     * Bridge exposed by the Electron preload script via `contextBridge` (FC-03).
     * `undefined` in a normal browser. FC-03 replaces `unknown` with `FansteDesktopBridge`.
     */
    fanste?: unknown;
  }
}

/** `true` when running inside the Fanste Collector desktop app (Electron), `false` in a browser or on the server. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && window.fanste !== undefined;
}

// The preload bridge is injected before any page script runs and never changes afterwards.
const subscribe = () => () => {};
const getServerSnapshot = () => false;

/**
 * React hook for {@link isDesktop}. Returns `false` during server rendering and hydration, then the
 * real value, so server and client markup always match.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktop, getServerSnapshot);
}
