import { useEffect, useState } from 'react';

/** Routeur minimal par hash (#/argent/budget) : fonctionne hors ligne et en PWA, bouton retour géré. */

export function useRoute(): string[] {
  const read = () => (window.location.hash.replace(/^#\/?/, '') || 'accueil').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  window.location.hash = '/' + path.replace(/^\//, '');
}

export function back(fallback: string) {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
}
