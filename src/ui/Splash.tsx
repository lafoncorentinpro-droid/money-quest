import { useEffect, useRef, useState } from 'react';
import type { MascotId } from '../domain/types';
import { Mascot } from './Mascot';

/**
 * Animation de lancement (2,8 s) — voir SPLASH-V2.md.
 * 0–0,4 s collines · 0,4–1,1 s pièce d'or · 1,1–1,7 s compagnon · 1,7–2,3 s logo · 2,3–2,8 s transition.
 * Passable d'un toucher après 1 s. Version réduite : fondu de 400 ms.
 */
const OUT_AT = 2300;
const OUT_DURATION = 500;

function Coin() {
  return (
    <svg viewBox="0 0 100 100" className="sp-coin-svg" aria-hidden>
      <defs>
        <radialGradient id="sp-gold" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#F8E3A3" />
          <stop offset="0.55" stopColor="#E6C372" />
          <stop offset="1" stopColor="#B58A2F" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="52" r="45" fill="#B58A2F" />
      <circle cx="50" cy="48" r="45" fill="url(#sp-gold)" />
      <circle cx="50" cy="48" r="34" fill="none" stroke="#B58A2F" strokeOpacity="0.45" strokeWidth="3" />
      <polygon
        points="50,29 54.4,40.9 67.1,41.4 57.1,49.3 60.6,61.6 50,54.5 39.4,61.6 42.9,49.3 32.9,41.4 45.6,40.9"
        fill="#FBEBC0"
        stroke="#B58A2F"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Splash({ animations, mascot }: { animations: boolean; mascot?: MascotId }) {
  const reduced = !animations || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>(() => {
    try {
      return sessionStorage.getItem('mq-splash') ? 'done' : 'in';
    } catch {
      return 'in';
    }
  });
  const start = useRef(performance.now());
  const timers = useRef<number[]>([]);

  const leave = (delay: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [window.setTimeout(() => setPhase('out'), delay), window.setTimeout(() => setPhase('done'), delay + (reduced ? 400 : OUT_DURATION))];
  };

  useEffect(() => {
    if (phase !== 'in') return;
    try {
      sessionStorage.setItem('mq-splash', '1');
    } catch {
      /* stockage indisponible : l'animation sera simplement rejouée */
    }
    leave(reduced ? 400 : OUT_AT);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  const skip = () => {
    if (phase === 'in' && performance.now() - start.current > 1000) leave(0);
  };

  const word = 'MONEY QUEST';
  return (
    <div className={`sp ${phase === 'out' ? 'is-out' : ''} ${reduced ? 'is-reduced' : ''}`} onClick={skip} aria-hidden>
      <div className="sp-sun" />
      <svg className="sp-hills" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
        <path className="sp-hill sp-hill-3" d="M0 118 Q70 40 140 92 T270 62 T400 96 V200 H0Z" />
        <path className="sp-hill sp-hill-2" d="M0 150 Q95 78 195 128 T400 116 V200 H0Z" />
        <path className="sp-hill sp-hill-1" d="M0 176 Q120 124 222 164 T400 158 V200 H0Z" />
      </svg>

      <div className="sp-center">
        <div className="sp-stage">
          <div className="sp-mascot">
            <div className="sp-breathe">
              <Mascot id={mascot} size={150} hello animate={false} />
            </div>
          </div>
          <div className="sp-coin">
            <div className="sp-coin-flip">
              <Coin />
              <span className="sp-shine" />
            </div>
          </div>
          <span className="sp-spark sp-spark-1">✦</span>
          <span className="sp-spark sp-spark-2">✦</span>
          <span className="sp-spark sp-spark-3">✦</span>
        </div>
        <div className="sp-word">
          {word.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1700 + i * 30}ms` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </div>
        <div className="sp-tagline">Ton budget, en aventure cosy</div>
      </div>
    </div>
  );
}
