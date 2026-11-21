import type { ReactNode } from 'react';

/** Icônes au trait des catégories, avec leur pastille de couleur (maquettes Money-Quest-ecrans). */
const CAT: Record<string, { bg: string; fg: string; d: ReactNode }> = {
  logement: { bg: '#DCEBF5', fg: '#29465D', d: <path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M10 20v-5h4v5" /> },
  courses: { bg: '#E3EEE2', fg: '#3F6A4C', d: <path d="M4 9h16l-1.6 10.5H5.6zM8.5 9 12 4l3.5 5M9.5 13v3.5M14.5 13v3.5" /> },
  restaurants: { bg: '#FBE3C8', fg: '#9A4F16', d: <path d="M7 3v7M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 10v11M18 21V3c-2.5 0-4 2.5-4 7h4" /> },
  transport: {
    bg: '#E6F0F8',
    fg: '#2F5878',
    d: (
      <>
        <rect x="5" y="3.5" width="14" height="14" rx="3" />
        <path d="M5 11h14M8.5 14.5h.01M15.5 14.5h.01M8 17.5V20M16 17.5V20" />
      </>
    )
  },
  voiture: {
    bg: '#E8E4F3',
    fg: '#56497F',
    d: (
      <>
        <path d="M4.5 15 6.5 9h11l2 6M6.5 19v1.5M17.5 19v1.5" />
        <rect x="3" y="15" width="18" height="4" rx="1.5" />
      </>
    )
  },
  abonnements: { bg: '#F6EBCD', fg: '#7A5A17', d: <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" /> },
  telephone: {
    bg: '#DCEBF5',
    fg: '#29465D',
    d: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M11 18h2" />
      </>
    )
  },
  sante: { bg: '#F6E1DC', fg: '#A4473A', d: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" /> },
  shopping: { bg: '#F7E3EC', fg: '#8E3D5E', d: <path d="M5 8h14l-1 13H6zM9 8a3 3 0 0 1 6 0" /> },
  loisirs: {
    bg: '#FBE3C8',
    fg: '#9A4F16',
    d: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
      </>
    )
  },
  voyages: { bg: '#E6F0F8', fg: '#2F5878', d: <path d="M3 13.5 21 6l-4.5 15-4-6.5zM12.5 14.5 21 6" /> },
  animaux: {
    bg: '#E3EEE2',
    fg: '#3F6A4C',
    d: (
      <>
        <circle cx="7" cy="10" r="1.8" />
        <circle cx="10.5" cy="6.5" r="1.8" />
        <circle cx="14.5" cy="6.5" r="1.8" />
        <circle cx="18" cy="10" r="1.8" />
        <path d="M8 17.5c0-2.5 2-4.5 4-4.5s4 2 4 4.5c0 2-2 2.5-4 2.5s-4-.5-4-2.5z" />
      </>
    )
  },
  cadeaux: {
    bg: '#F7E3EC',
    fg: '#8E3D5E',
    d: (
      <>
        <rect x="4" y="10" width="16" height="10.5" rx="1.5" />
        <path d="M3 7h18v3H3zM12 7v13.5M12 7C10.5 3.5 7 4 8 6.5M12 7c1.5-3.5 5-3 4-.5" />
      </>
    )
  },
  impots: { bg: '#ECE6DA', fg: '#5C5340', d: <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2zM9 7.5h6M9 11.5h6" /> },
  autres: { bg: '#F6EBCD', fg: '#7A5A17', d: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" /> },
  // Budget de base (revenus) et récurrences
  _income: { bg: '#DCEBF5', fg: '#29465D', d: <path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M10 20v-5h4v5" /> },
  _recurring: { bg: '#F6EBCD', fg: '#7A5A17', d: <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" /> }
};

export function hasCatIcon(id?: string): boolean {
  return !!id && id in CAT;
}

/** Pastille d'icône de catégorie. `fallback` (emoji) pour les catégories personnalisées. */
export function CatIcon({ id, fallback, size = 40, dashed }: { id?: string; fallback?: string; size?: number; dashed?: boolean }) {
  const c = id ? CAT[id] : undefined;
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.3), background: c?.bg ?? 'var(--surface-2)', color: c?.fg ?? 'var(--text)' };
  return (
    <span className={`cat-icon ${dashed ? 'is-dashed' : ''}`} style={style} aria-hidden>
      {c ? (
        <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {c.d}
        </svg>
      ) : (
        <span style={{ fontSize: size * 0.48 }}>{fallback ?? '🪙'}</span>
      )}
    </span>
  );
}
