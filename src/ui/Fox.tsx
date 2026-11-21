import type { Equipment } from '../domain/types';

/**
 * Mascotte : petit renard aventurier, dessiné en SVG (provisoire et léger).
 * Pour utiliser tes propres illustrations, voir README > « Remplacer les visuels ».
 */

export type FoxMood = 'accueil' | 'heureux' | 'fier' | 'surpris' | 'concentre' | 'encourageant' | 'repos' | 'celebration' | 'reflexion' | 'exploration';

const SCARF: Record<string, string> = {
  'echarpe-bleue': '#5b8fc0',
  'echarpe-sauge': '#7fa58a',
  'echarpe-doree': '#d9a94a',
  'echarpe-nuit': '#29465d'
};

interface Props {
  mood?: FoxMood;
  size?: number;
  equipped?: Equipment;
  animate?: boolean;
  title?: string;
}

export function Fox({ mood = 'accueil', size = 96, equipped = { scarf: 'echarpe-bleue' }, animate = true, title }: Props) {
  const scarf = SCARF[equipped.scarf] ?? SCARF['echarpe-bleue'];
  const closed = mood === 'repos' || mood === 'heureux' || mood === 'celebration';
  const surprised = mood === 'surpris';
  const arms = mood === 'celebration' || mood === 'fier';

  return (
    <svg
      viewBox="0 0 120 130"
      width={size}
      height={size * (130 / 120)}
      role="img"
      aria-label={title ?? 'Le renard aventurier'}
      className={animate ? 'fox-bob' : undefined}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      {/* ombre */}
      <ellipse cx="60" cy="124" rx="30" ry="4" fill="rgba(41,70,93,.12)" />
      {/* queue */}
      <path d="M86 98 C112 92 116 64 100 56 C104 76 92 86 80 88 Z" fill="var(--fur)" />
      <path d="M100 56 C110 62 110 72 104 76 C104 68 102 62 100 56 Z" fill="#fffaf2" />
      {/* sac à dos */}
      <rect x="30" y="74" width="16" height="26" rx="6" fill="#8a6a4a" />
      <rect x="32" y="80" width="12" height="7" rx="3" fill="#a5835f" />
      {/* corps */}
      <path d="M40 120 C36 96 42 76 60 76 C78 76 84 96 80 120 Z" fill="var(--fur)" />
      <path d="M50 120 C48 102 52 88 60 88 C68 88 72 102 70 120 Z" fill="#fffaf2" />
      {/* pattes */}
      <ellipse cx="50" cy="121" rx="8" ry="4.5" fill="#5b3d2a" />
      <ellipse cx="70" cy="121" rx="8" ry="4.5" fill="#5b3d2a" />
      {/* bras */}
      {arms ? (
        <>
          <path d="M42 86 C34 78 32 70 34 64" stroke="var(--fur)" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M78 86 C86 78 88 70 86 64" stroke="var(--fur)" strokeWidth="7" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M44 88 C40 96 40 102 44 106" stroke="var(--fur)" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M76 88 C80 96 80 102 76 106" stroke="var(--fur)" strokeWidth="7" strokeLinecap="round" fill="none" />
        </>
      )}
      {/* écharpe */}
      <path d="M42 76 C52 82 68 82 78 76 L78 84 C68 89 52 89 42 84 Z" fill={scarf} />
      <path d="M68 84 L74 100 L66 99 L63 85 Z" fill={scarf} />
      {/* tête */}
      <path d="M30 22 L44 44 L36 50 Z" fill="var(--fur)" />
      <path d="M90 22 L76 44 L84 50 Z" fill="var(--fur)" />
      <path d="M34 28 L42 42 L38 45 Z" fill="#5b3d2a" opacity=".55" />
      <path d="M86 28 L78 42 L82 45 Z" fill="#5b3d2a" opacity=".55" />
      <path d="M60 32 C82 32 92 48 90 60 C88 72 76 80 60 80 C44 80 32 72 30 60 C28 48 38 32 60 32 Z" fill="var(--fur)" />
      <path d="M60 58 C72 58 84 62 86 66 C80 76 70 80 60 80 C50 80 40 76 34 66 C36 62 48 58 60 58 Z" fill="#fffaf2" />
      {/* yeux */}
      {closed ? (
        <>
          <path d="M44 56 Q49 51 54 56" stroke="#29465d" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M66 56 Q71 51 76 56" stroke="#29465d" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="49" cy="55" rx={surprised ? 5.5 : 5} ry={surprised ? 6.5 : 5.8} fill="#29465d" />
          <ellipse cx="71" cy="55" rx={surprised ? 5.5 : 5} ry={surprised ? 6.5 : 5.8} fill="#29465d" />
          <circle cx="50.6" cy="53" r="1.8" fill="#fff" />
          <circle cx="72.6" cy="53" r="1.8" fill="#fff" />
        </>
      )}
      {mood === 'reflexion' || mood === 'concentre' ? <path d="M42 46 L54 48 M78 46 L66 48" stroke="#5b3d2a" strokeWidth="2" strokeLinecap="round" /> : null}
      {/* joues */}
      <ellipse cx="40" cy="64" rx="4.5" ry="2.6" fill="#f3a68a" opacity=".6" />
      <ellipse cx="80" cy="64" rx="4.5" ry="2.6" fill="#f3a68a" opacity=".6" />
      {/* museau */}
      <ellipse cx="60" cy="64" rx="4" ry="3" fill="#29465d" />
      {surprised ? (
        <ellipse cx="60" cy="72" rx="3" ry="3.5" fill="#5b3d2a" />
      ) : (
        <path d="M54 70 Q60 75 66 70" stroke="#29465d" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}

      {/* chapeaux */}
      {equipped.hat === 'chapeau-explorateur' && (
        <g>
          <ellipse cx="60" cy="34" rx="34" ry="7" fill="#b08a5a" />
          <path d="M42 34 C42 18 78 18 78 34 Z" fill="#c9a26f" />
          <rect x="42" y="28" width="36" height="5" fill="#8a6a4a" />
        </g>
      )}
      {equipped.hat === 'bonnet' && (
        <g>
          <path d="M38 38 C38 14 82 14 82 38 Z" fill="#c9605a" />
          <rect x="36" y="34" width="48" height="8" rx="4" fill="#f5f0e5" />
          <circle cx="60" cy="14" r="6" fill="#f5f0e5" />
        </g>
      )}
      {equipped.hat === 'couronne-fleurs' && (
        <g>
          {[40, 50, 60, 70, 80].map((x, i) => (
            <circle key={x} cx={x} cy={33 - (i === 2 ? 3 : i % 2 ? 1 : 0)} r="5" fill={['#f2b8c6', '#f6e3a1', '#b9d9ef', '#f6e3a1', '#f2b8c6'][i]} />
          ))}
          {[45, 55, 65, 75].map((x) => (
            <ellipse key={x} cx={x} cy="35" rx="3" ry="2" fill="#7fa58a" />
          ))}
        </g>
      )}
      {equipped.hat === 'couronne' && (
        <path d="M44 36 L44 20 L52 28 L60 16 L68 28 L76 20 L76 36 Z" fill="#e6c372" stroke="#b58a2f" strokeWidth="1.5" />
      )}

      {/* accessoires */}
      {equipped.accessory === 'lanterne' && (
        <g>
          <line x1="88" y1="92" x2="88" y2="100" stroke="#5b3d2a" strokeWidth="2" />
          <rect x="82" y="100" width="12" height="14" rx="3" fill="#f6e3a1" stroke="#8a6a4a" strokeWidth="2" />
          <circle cx="88" cy="107" r="3" fill="#f2b84b" />
        </g>
      )}
      {equipped.accessory === 'carte' && (
        <g>
          <path d="M12 96 L26 92 L38 96 L38 112 L26 108 L12 112 Z" fill="#f5f0e5" stroke="#b08a5a" strokeWidth="1.5" />
          <path d="M18 100 L24 104 L32 100" stroke="#c9605a" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
        </g>
      )}
      {equipped.accessory === 'boussole' && (
        <g>
          <circle cx="90" cy="106" r="9" fill="#e6c372" stroke="#b58a2f" strokeWidth="2" />
          <path d="M90 99 L93 106 L90 113 L87 106 Z" fill="#c9605a" />
        </g>
      )}
      {equipped.accessory === 'etoile' && <path d="M96 30 L99 38 L107 38 L101 43 L103 51 L96 46 L89 51 L91 43 L85 38 L93 38 Z" fill="#f6d27a" />}

      {mood === 'celebration' && (
        <g fill="#e6c372">
          <circle cx="20" cy="40" r="3" />
          <circle cx="102" cy="22" r="2.5" />
          <circle cx="14" cy="70" r="2" />
          <path d="M104 46 l2 5 l5 0 l-4 3 l2 5 l-5 -3 l-5 3 l2 -5 l-4 -3 l5 0 Z" />
        </g>
      )}
      {mood === 'exploration' && !equipped.accessory && (
        <g>
          <path d="M12 96 L26 92 L38 96 L38 112 L26 108 L12 112 Z" fill="#f5f0e5" stroke="#b08a5a" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
}
