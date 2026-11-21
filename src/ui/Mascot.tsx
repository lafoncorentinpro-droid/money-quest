import { useState } from 'react';
import type { MascotId } from '../domain/types';
import { useStore } from '../store/store';

/** Les 4 compagnons (images dans public/compagnons). Voir COMPAGNONS.md. */
export const MASCOTS: { id: MascotId; name: string; hello?: string }[] = [
  { id: 'chat', name: 'Le chat' },
  { id: 'loutre', name: 'La loutre', hello: 'loutre-coucou' },
  { id: 'lion', name: 'Le lion' },
  { id: 'renard', name: 'Le renard' }
];

const src = (file: string) => `${import.meta.env.BASE_URL}compagnons/${file}.webp`;

export function Mascot({ id, size = 64, hello, animate = true }: { id?: MascotId; size?: number; hello?: boolean; animate?: boolean }) {
  const m = MASCOTS.find((x) => x.id === id) ?? MASCOTS[3];
  const file = hello && m.hello ? m.hello : m.id;
  return <img src={src(file)} alt={m.name} className={`mascot ${animate ? 'fox-bob' : ''}`} style={{ height: size }} draggable={false} />;
}

/** Écran plein du premier lancement : choisir son compagnon, une seule fois. */
export function MascotPicker() {
  const { dispatch } = useStore();
  const [picked, setPicked] = useState<MascotId | null>(null);
  const [leaving, setLeaving] = useState(false);
  const name = MASCOTS.find((m) => m.id === picked)?.name.replace(/^(Le|La) /, '').toLowerCase();

  const confirm = () => {
    if (!picked) return;
    setLeaving(true);
    setTimeout(() => dispatch({ type: 'settings/update', settings: { mascot: picked } }), 320);
  };

  return (
    <div className={`picker ${leaving ? 'is-out' : ''}`} role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="picker-head">
        <h1 id="picker-title">Choisis ton compagnon</h1>
        <p className="muted">Il t’accompagnera dans ton budget. Tu pourras le changer dans Réglages.</p>
      </div>
      <div className="picker-grid">
        {MASCOTS.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className="picker-card"
            aria-pressed={picked === m.id}
            onClick={() => setPicked(m.id)}
            style={{ animationDelay: `${120 + i * 60}ms` }}
          >
            <img src={src(m.hello ?? m.id)} alt="" draggable={false} />
            <strong>{m.name}</strong>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-block picker-go" disabled={!picked} onClick={confirm}>
        {picked ? `C’est parti avec ${picked === 'loutre' ? 'la' : 'le'} ${name} !` : 'Choisis un compagnon'}
      </button>
    </div>
  );
}

/** Choix du compagnon dans Réglages. */
export function MascotSettings() {
  const { data, dispatch } = useStore();
  return (
    <div className="mascot-row" role="group" aria-label="Mon compagnon">
      {MASCOTS.map((m) => (
        <button
          key={m.id}
          type="button"
          className="picker-card picker-card-sm"
          aria-pressed={(data.settings.mascot ?? 'renard') === m.id}
          onClick={() => dispatch({ type: 'settings/update', settings: { mascot: m.id } })}
        >
          <img src={src(m.id)} alt="" draggable={false} />
          <span className="tiny">{m.name.replace(/^(Le|La) /, '')}</span>
        </button>
      ))}
    </div>
  );
}
