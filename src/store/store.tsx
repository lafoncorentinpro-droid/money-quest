import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { currentPeriod } from '../domain/finance';
import { levelFromXp, totalXp } from '../domain/game';
import { formatCents } from '../domain/money';
import { todayISO } from '../domain/dates';
import type { AppData, PeriodKey } from '../domain/types';
import { loadData, markLoaded, requestPersistence, saveData } from './db';
import { ActionError, reduce, type Action } from './reducer';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error' | 'level';
}

interface StoreValue {
  data: AppData;
  today: string;
  period: PeriodKey;
  /** Exécute une action ; renvoie false (avec message) si elle est refusée. */
  dispatch: (a: Action) => boolean;
  toast: (text: string, tone?: Toast['tone']) => void;
  money: (cents: number) => string;
  storageMessage?: string;
  saveError?: string;
  levelUp?: number;
  clearLevelUp: () => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore hors du StoreProvider');
  return v;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [storageMessage, setStorageMessage] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<number>();
  const [today, setToday] = useState(todayISO());
  const dataRef = useRef<AppData | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    loadData().then((res) => {
      markLoaded(res.data);
      dataRef.current = res.data;
      setData(res.data);
      if (res.message) setStorageMessage(res.message);
      requestPersistence();
    });
    // Le jour change pendant que l'app est ouverte (minuit, retour d'arrière-plan)
    const tick = () => setToday(todayISO());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const persist = useCallback((d: AppData) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveData(d)
        .then(() => setSaveError(undefined))
        .catch((e: Error) => setSaveError(`La dernière modification n’a pas pu être enregistrée sur l’appareil (${e.message}). Exporte une sauvegarde par précaution.`));
    }, 250);
  }, []);

  // Sauvegarde immédiate si l'app passe en arrière-plan
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && dataRef.current) saveData(dataRef.current).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, []);

  const dispatch = useCallback(
    (a: Action) => {
      const cur = dataRef.current;
      if (!cur) return false;
      try {
        const next = reduce(cur, { ...a, today: todayISO() } as never);
        if (next === cur) return true;
        const before = levelFromXp(totalXp(cur.progress));
        const after = levelFromXp(totalXp(next.progress));
        if (after > before && a.type !== 'data/replace') setLevelUp(after);
        dataRef.current = next;
        setData(next);
        persist(next);
        return true;
      } catch (e) {
        if (e instanceof ActionError) toast(e.message, 'error');
        else {
          console.error(e);
          toast('Une erreur inattendue est survenue. Rien n’a été modifié.', 'error');
        }
        return false;
      }
    },
    [persist, toast]
  );

  const value = useMemo<StoreValue | null>(() => {
    if (!data) return null;
    return {
      data,
      today,
      period: currentPeriod(data, today),
      dispatch,
      toast,
      money: (c: number) => formatCents(c, data.settings.currency),
      storageMessage,
      saveError,
      levelUp,
      clearLevelUp: () => setLevelUp(undefined)
    };
  }, [data, today, dispatch, toast, storageMessage, saveError, levelUp]);

  if (!value) {
    return (
      <div className="splash" role="status">
        <span className="splash-dot" /> Chargement de ton aventure…
      </div>
    );
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
