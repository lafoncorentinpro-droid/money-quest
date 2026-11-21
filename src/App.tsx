import { useEffect, useRef, useState } from 'react';
import { goalBalance } from './domain/finance';
import { COSMETICS, REGIONS } from './domain/game';
import { Home } from './pages/Home';
import { Money } from './pages/Money';
import { Profile } from './pages/Profile';
import { Treasures } from './pages/Treasures';
import { World } from './pages/World';
import { useStore } from './store/store';
import { Fox } from './ui/Fox';
import { go, useRoute } from './ui/router';
import { SheetsProvider, useSheets } from './ui/sheets';

const TABS = [
  { id: 'accueil', label: 'Accueil', icon: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { id: 'monde', label: 'Monde', icon: <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zm0 0v13m6-10.5v13" /> },
  {
    id: 'argent',
    label: 'Mon Argent',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="3" />
        <path d="M16 12.5h2M3 10h18" />
      </>
    )
  },
  {
    id: 'tresors',
    label: 'Trésors',
    icon: (
      <>
        <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4M11 13h2v3h-2z" />
      </>
    )
  },
  {
    id: 'profil',
    label: 'Profil',
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.8" />
        <path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" />
      </>
    )
  }
];

function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <a key={t.id} href={`#/${t.id}`} className="tab" aria-current={current === t.id ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {t.icon}
            </svg>
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

interface Celebration {
  title: string;
  text: string;
}

function Celebrate({ c, onClose }: { c: Celebration; onClose: () => void }) {
  const { data } = useStore();
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-label={c.title} onClick={onClose}>
      <div className="card stack" onClick={(e) => e.stopPropagation()}>
        <div className="sparkles" aria-hidden>
          ✨ ⭐ ✨
        </div>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <Fox mood="celebration" size={110} equipped={data.progress.equipped} animate={data.settings.animations} />
        </div>
        <h2>{c.title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {c.text}
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
          Continuer
        </button>
      </div>
    </div>
  );
}

/** Détecte niveaux et objectifs atteints pour une célébration douce (désactivable via les animations). */
function useCelebrations(): [Celebration | null, () => void] {
  const { data, levelUp, clearLevelUp } = useStore();
  const [queue, setQueue] = useState<Celebration[]>([]);
  const reached = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!levelUp) return;
    const region = REGIONS.find((r) => r.minLevel === levelUp);
    const items = COSMETICS.filter((c) => c.level === levelUp).map((c) => c.name);
    const extra = [region ? `Nouvelle région découverte : ${region.name} !` : '', items.length ? `Débloqué : ${items.join(', ')}.` : ''].filter(Boolean).join(' ');
    setQueue((q) => [...q, { title: `Niveau ${levelUp} !`, text: extra || 'Tes bonnes habitudes portent leurs fruits.' }]);
    clearLevelUp();
  }, [levelUp, clearLevelUp]);

  useEffect(() => {
    const now = new Set(data.goals.filter((g) => g.target > 0 && goalBalance(g.id, data.movements) >= g.target).map((g) => g.id));
    if (reached.current) {
      for (const id of now) {
        if (!reached.current.has(id)) {
          const g = data.goals.find((x) => x.id === id)!;
          setQueue((q) => [...q, { title: 'Trésor rempli !', text: `Ton objectif « ${g.name} » est atteint. Bravo pour ta régularité !` }]);
        }
      }
    }
    reached.current = now;
  }, [data.goals, data.movements]);

  return [queue[0] ?? null, () => setQueue((q) => q.slice(1))];
}

function Shell() {
  const route = useRoute();
  const { data, storageMessage, saveError } = useStore();
  const open = useSheets();
  const [celebration, next] = useCelebrations();
  const [tab, sub, arg] = route;

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme === 'auto' ? '' : data.settings.theme;
    if (data.settings.theme === 'auto') delete document.documentElement.dataset.theme;
    document.body.classList.toggle('no-anim', !data.settings.animations);
  }, [data.settings.theme, data.settings.animations]);

  useEffect(() => {
    if (!TABS.some((t) => t.id === tab)) go('accueil');
  }, [tab]);

  let page;
  switch (tab) {
    case 'monde':
      page = <World />;
      break;
    case 'argent':
      page = <Money sub={sub} arg={arg} />;
      break;
    case 'tresors':
      page = <Treasures id={sub} />;
      break;
    case 'profil':
      page = <Profile />;
      break;
    default:
      page = <Home />;
  }

  return (
    <>
      <main className="app">
        {storageMessage && <div className="notice notice-warn small" style={{ marginBottom: 12 }}>{storageMessage}</div>}
        {saveError && (
          <div className="notice notice-warn small" role="alert" style={{ marginBottom: 12 }}>
            {saveError}
          </div>
        )}
        <div key={tab + (sub ?? '')}>{page}</div>
      </main>
      <button type="button" className="fab" aria-label="Ajouter une opération" onClick={() => open({ kind: 'quick' })}>
        +
      </button>
      <TabBar current={tab ?? 'accueil'} />
      {celebration && data.settings.animations && <Celebrate c={celebration} onClose={next} />}
      {celebration && !data.settings.animations && <AutoSkip onSkip={next} />}
    </>
  );
}

function AutoSkip({ onSkip }: { onSkip: () => void }) {
  const { toast } = useStore();
  useEffect(() => {
    toast('🎉 Bravo !', 'level');
    onSkip();
  }, [onSkip, toast]);
  return null;
}

export function App() {
  return (
    <SheetsProvider>
      <Shell />
    </SheetsProvider>
  );
}
