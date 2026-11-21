import { useEffect, useState } from 'react';

/** Écran de lancement animé (une fois par ouverture de l'app). Voir ANIMATIONS.md § 1. */
export function Splash({ animations }: { animations: boolean }) {
  const reduced = !animations || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>(() => {
    try {
      return sessionStorage.getItem('mq-splash') ? 'done' : 'in';
    } catch {
      return 'in';
    }
  });

  useEffect(() => {
    if (phase !== 'in') return;
    try {
      sessionStorage.setItem('mq-splash', '1');
    } catch {
      /* stockage indisponible : on rejouera simplement l'animation */
    }
    const outAt = reduced ? 250 : 1500;
    const t1 = setTimeout(() => setPhase('out'), outAt);
    const t2 = setTimeout(() => setPhase('done'), outAt + (reduced ? 300 : 420));
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, reduced]);

  if (phase === 'done') return null;
  const word = 'MONEY QUEST';
  return (
    <div className={`splash-screen ${phase === 'out' ? 'is-out' : ''} ${reduced ? 'is-reduced' : ''}`} aria-hidden>
      <div className="splash-logo">
        <span className="splash-halo" />
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={112} height={112} />
      </div>
      <div className="splash-word">
        {word.split('').map((ch, i) => (
          <span key={i} style={{ animationDelay: `${380 + i * 35}ms` }}>
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </div>
      <div className="splash-tagline">Ton budget, simplement.</div>
    </div>
  );
}
