import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNetworkState } from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { getInstallId, getJSON, setJSON } from '@/db/settings';
import { ApiError, fetchCapabilities, onlineConfigured, setInstallId, type ServerCapabilities } from './api';

export type OnlineStatus = 'not_configured' | 'offline' | 'checking' | 'ready' | 'unreachable';

interface OnlineValue {
  /** True when the phone reports a network connection. */
  connected: boolean;
  status: OnlineStatus;
  caps: ServerCapabilities | null;
  checkedAt: number | null;
  error: string | null;
  refresh: () => void;
}

const OnlineContext = createContext<OnlineValue | null>(null);

/**
 * Tracks connectivity and what the LUMA server can do. Everything here is
 * optional: reading, saving and the Vision Profile never depend on it.
 */
export function OnlineProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const net = useNetworkState();
  const connected = net.isConnected === true && net.isInternetReachable !== false;
  const [caps, setCaps] = useState<ServerCapabilities | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<OnlineStatus>(onlineConfigured ? 'checking' : 'not_configured');
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    getInstallId(db).then(setInstallId).catch(() => {});
    getJSON<{ caps: ServerCapabilities; at: number }>(db, 'capabilities_cache').then((c) => {
      if (c) {
        setCaps((prev) => prev ?? c.caps);
        setCheckedAt((prev) => prev ?? c.at);
      }
    });
  }, [db]);

  const refresh = useCallback(() => {
    if (!onlineConfigured) {
      setStatus('not_configured');
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    setStatus('checking');
    fetchCapabilities()
      .then((c) => {
        const at = Date.now();
        setCaps(c);
        setCheckedAt(at);
        setError(null);
        setStatus('ready');
        setJSON(db, 'capabilities_cache', { caps: c, at }).catch(() => {});
      })
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : 'Could not check online features.');
        setStatus('unreachable');
      })
      .finally(() => {
        inflight.current = false;
      });
  }, [db]);

  useEffect(() => {
    if (!onlineConfigured) return;
    if (connected) refresh();
    else setStatus('offline');
  }, [connected, refresh]);

  const value = useMemo<OnlineValue>(
    () => ({ connected, status: onlineConfigured ? (connected ? status : 'offline') : 'not_configured', caps, checkedAt, error, refresh }),
    [connected, status, caps, checkedAt, error, refresh],
  );
  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

export function useOnline(): OnlineValue {
  const v = useContext(OnlineContext);
  if (!v) throw new Error('useOnline must be used inside OnlineProvider');
  return v;
}
