import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { formatDateShort } from '../domain/dates';
import { levelProgress, MISSIONS, missionsView, REGIONS, totalXp, type Region } from '../domain/game';
import { useStore } from '../store/store';
import { PageHead, Progress } from '../ui/components';
import { Fox } from '../ui/Fox';

/** Carte du monde : SVG interactif (tap, glisser, pincer / boutons de zoom) + alternative en liste. */

const POS: Record<string, { x: number; y: number }> = {
  village: { x: 115, y: 420 },
  foret: { x: 285, y: 345 },
  lac: { x: 120, y: 255 },
  montagnes: { x: 285, y: 160 },
  royaume: { x: 135, y: 70 }
};

const W = 400;
const H = 500;

function Scene({ id }: { id: string }) {
  const { x, y } = POS[id];
  switch (id) {
    case 'village':
      return (
        <g>
          <path d={`M${x - 70} ${y + 40} Q${x} ${y + 10} ${x + 70} ${y + 44}`} stroke="#8DBBD9" strokeWidth="9" fill="none" strokeLinecap="round" />
          {[
            [-38, -14, '#e9a56b'],
            [-6, -26, '#5b8fc0'],
            [26, -12, '#c9605a'],
            [-20, 14, '#7fa58a']
          ].map(([dx, dy, roof], i) => (
            <g key={i} transform={`translate(${x + (dx as number)} ${y + (dy as number)})`}>
              <rect x="-9" y="-2" width="18" height="14" rx="2" fill="#fffaf2" stroke="#d9cdb4" />
              <path d="M-12 -1 L0 -12 L12 -1 Z" fill={roof as string} />
              <rect x="-2.5" y="5" width="5" height="7" fill="#b08a5a" />
            </g>
          ))}
          <g transform={`translate(${x + 46} ${y - 30})`}>
            <rect x="-5" y="-4" width="10" height="20" fill="#e6dfcf" />
            <path d="M0 -4 L-12 -16 M0 -4 L12 -16 M0 -4 L-12 8 M0 -4 L12 8" stroke="#8a6a4a" strokeWidth="3" />
          </g>
        </g>
      );
    case 'foret':
      return (
        <g>
          {[
            [-44, -6, 18],
            [-18, -26, 22],
            [14, -12, 20],
            [40, -30, 16],
            [-30, 22, 16],
            [6, 18, 18],
            [38, 12, 15]
          ].map(([dx, dy, r], i) => (
            <g key={i}>
              <rect x={x + dx - 2} y={y + dy + r * 0.6} width="4" height={r * 0.6} fill="#8a6a4a" />
              <circle cx={x + dx} cy={y + dy} r={r} fill={i % 2 ? '#7fa58a' : '#9FBF9A'} />
            </g>
          ))}
          <circle cx={x - 4} cy={y + 2} r="3" fill="#f6d27a" />
          <circle cx={x + 24} cy={y - 40} r="2.5" fill="#f6d27a" />
        </g>
      );
    case 'lac':
      return (
        <g>
          <ellipse cx={x} cy={y} rx="62" ry="36" fill="#8DBBD9" />
          <ellipse cx={x - 8} cy={y - 6} rx="44" ry="22" fill="#B9D9EF" />
          <ellipse cx={x + 22} cy={y + 4} rx="10" ry="6" fill="#9FBF9A" />
          <rect x={x - 66} y={y + 6} width="22" height="4" fill="#b08a5a" />
          <g transform={`translate(${x - 54} ${y - 26})`}>
            <rect x="-8" y="-2" width="16" height="12" fill="#c9a26f" />
            <path d="M-10 -2 L0 -10 L10 -2 Z" fill="#8a6a4a" />
          </g>
          <g transform={`translate(${x + 22} ${y - 4})`}>
            <rect x="-6" y="-4" width="12" height="8" rx="1.5" fill="#b08a5a" />
            <rect x="-6" y="-4" width="12" height="3" fill="#e6c372" />
          </g>
        </g>
      );
    case 'montagnes':
      return (
        <g>
          <path d={`M${x - 75} ${y + 40} L${x - 35} ${y - 30} L${x} ${y + 40} Z`} fill="#c9b48a" />
          <path d={`M${x - 30} ${y + 40} L${x + 10} ${y - 50} L${x + 50} ${y + 40} Z`} fill="#D9B86A" />
          <path d={`M${x + 20} ${y + 40} L${x + 52} ${y - 18} L${x + 80} ${y + 40} Z`} fill="#c9b48a" />
          <path d={`M${x + 10} ${y - 50} L${x - 2} ${y - 28} L${x + 22} ${y - 28} Z`} fill="#fffaf2" />
          <path d={`M${x - 35} ${y - 30} L${x - 44} ${y - 14} L${x - 26} ${y - 14} Z`} fill="#fffaf2" />
          <path d={`M${x + 4} ${y + 38} q 6 -20 -2 -40`} stroke="#B9D9EF" strokeWidth="4" fill="none" />
          <circle cx={x + 52} cy={y - 24} r="5" fill="#e6dfcf" stroke="#8a6a4a" />
        </g>
      );
    case 'royaume':
      return (
        <g>
          <rect x={x - 30} y={y - 10} width="60" height="34" fill="#efe6f5" stroke="#C9A7D9" />
          {[-30, -6, 18].map((dx) => (
            <g key={dx}>
              <rect x={x + dx} y={y - 26} width="12" height="18" fill="#e3d4ee" stroke="#C9A7D9" />
              <path d={`M${x + dx - 2} ${y - 26} L${x + dx + 6} ${y - 40} L${x + dx + 14} ${y - 26} Z`} fill="#5b8fc0" />
            </g>
          ))}
          <path d={`M${x - 6} ${y + 24} v-12 a6 6 0 0 1 12 0 v12 Z`} fill="#8a6a4a" />
          <circle cx={x + 42} cy={y - 34} r="3" fill="#f6d27a" />
          <circle cx={x - 46} cy={y - 18} r="2" fill="#f6d27a" />
        </g>
      );
  }
  return null;
}

function Fog({ x, y }: { x: number; y: number }) {
  return (
    <g fill="var(--map-fog)" aria-hidden>
      <circle cx={x - 40} cy={y + 6} r="40" />
      <circle cx={x} cy={y - 14} r="48" />
      <circle cx={x + 42} cy={y + 4} r="40" />
      <circle cx={x} cy={y + 26} r="44" />
    </g>
  );
}

export function World() {
  const { data, period, money: _money } = useStore();
  void _money;
  const xp = totalXp(data.progress);
  const lp = levelProgress(xp);
  const unlocked = data.progress.unlockedRegions;
  const isOpen = (r: Region) => !!unlocked[r.id] || lp.level >= r.minLevel;
  const [sel, setSel] = useState<string>(REGIONS.filter(isOpen).slice(-1)[0]?.id ?? 'village');
  const [vb, setVb] = useState({ x: 0, y: 0, w: W, h: H });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number; dist?: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const moved = useRef(0);

  const clamp = (v: { x: number; y: number; w: number; h: number }) => {
    const w = Math.min(W, Math.max(W / 3, v.w));
    const h = (w / W) * H;
    return { w, h, x: Math.min(W - w, Math.max(0, v.x)), y: Math.min(H - h, Math.max(0, v.y)) };
  };
  const zoom = (factor: number, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => {
    const w = vb.w * factor;
    const h = vb.h * factor;
    setVb(clamp({ x: cx - (cx - vb.x) * factor, y: cy - (cy - vb.y) * factor, w, h }));
  };
  const scale = () => (svgRef.current ? vb.w / svgRef.current.clientWidth : 1);

  const onDown = (e: RPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    const pts = [...pointers.current.values()];
    last.current = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2, dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) } : { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !last.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && last.current.dist) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoom(last.current.dist / dist);
      last.current = { ...last.current, dist };
      moved.current += 10;
      return;
    }
    const dx = (e.clientX - last.current.x) * scale();
    const dy = (e.clientY - last.current.y) * scale();
    moved.current += Math.abs(dx) + Math.abs(dy);
    if (moved.current > 4) {
      if (!(e.currentTarget as Element).hasPointerCapture(e.pointerId)) (e.currentTarget as Element).setPointerCapture(e.pointerId);
      setVb((v) => clamp({ ...v, x: v.x - dx, y: v.y - dy }));
    }
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) last.current = null;
  };

  const region = REGIONS.find((r) => r.id === sel)!;
  const regionOpen = isOpen(region);
  const missions = missionsView(data, period);
  const path = REGIONS.map((r, i) => `${i ? 'L' : 'M'}${POS[r.id].x} ${POS[r.id].y}`).join(' ');

  return (
    <div className="page">
      <PageHead title="Le Monde" />
      <section className="card row">
        <Fox mood="exploration" size={64} equipped={data.progress.equipped} animate={data.settings.animations} />
        <div className="grow stack" style={{ gap: 6 }}>
          <div className="row-between">
            <strong>Niveau {lp.level}</strong>
            <span className="tiny num">{xp} XP</span>
          </div>
          <Progress value={lp.into} max={lp.needed || 1} tone="xp" label="Progression du niveau" />
          <span className="tiny">{lp.needed ? `${lp.needed - lp.into} XP avant le niveau ${lp.level + 1}` : 'Niveau maximum !'}</span>
        </div>
      </section>

      <div className="map-wrap" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="group" aria-label="Carte du monde">
          <defs>
            <pattern id="paper" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="0.8" fill="#ffffff" opacity=".6" />
              <circle cx="13" cy="11" r="0.6" fill="#ffffff" opacity=".5" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="#DCEBF5" />
          <rect width={W} height={H} fill="url(#paper)" />
          <path d="M0 470 Q 120 440 200 480 T 400 460 L400 500 L0 500 Z" fill="#B9D9EF" opacity=".7" />
          <path d={path} stroke="#c9b48a" strokeWidth="5" strokeDasharray="2 9" strokeLinecap="round" fill="none" />
          {REGIONS.map((r) => {
            const { x, y } = POS[r.id];
            const o = isOpen(r);
            const active = r.id === sel;
            return (
              <g
                key={r.id}
                className="region-hit"
                tabIndex={0}
                role="button"
                aria-label={`${r.name}, ${o ? 'débloquée' : `se révèle au niveau ${r.minLevel}`}`}
                aria-pressed={active}
                onClick={() => moved.current < 6 && setSel(r.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(r.id))}
              >
                <ellipse className="region-ring" cx={x} cy={y} rx="88" ry="62" fill={r.color} opacity={o ? 0.35 : 0.18} stroke={active ? '#29465d' : 'transparent'} strokeWidth="3" strokeDasharray={active ? '0' : '0'} />
                <Scene id={r.id} />
                {!o && <Fog x={x} y={y} />}
                <g transform={`translate(${x} ${y + 58})`}>
                  <rect x={-r.name.length * 3.1 - 8} y="-11" width={r.name.length * 6.2 + 16} height="20" rx="10" fill="#fffdf8" stroke="#e6dfcf" />
                  <text textAnchor="middle" y="3.5" fontSize="10.5" fontWeight="700" fill="#29465d" fontFamily="system-ui, sans-serif">
                    {o ? r.name : `🔒 Niveau ${r.minLevel}`}
                  </text>
                </g>
              </g>
            );
          })}
          {(() => {
            const cur = [...REGIONS].reverse().find(isOpen) ?? REGIONS[0];
            return (
              <g transform={`translate(${POS[cur.id].x + 50} ${POS[cur.id].y - 46})`} aria-hidden>
                <circle r="13" fill="#fffdf8" stroke="#e8893f" strokeWidth="2.5" />
                <text textAnchor="middle" y="5" fontSize="14">
                  🦊
                </text>
              </g>
            );
          })()}
        </svg>
        <div className="map-tools">
          <button type="button" aria-label="Zoomer" onClick={() => zoom(0.75)}>
            +
          </button>
          <button type="button" aria-label="Dézoomer" onClick={() => zoom(1 / 0.75)}>
            −
          </button>
          <button type="button" aria-label="Vue d’ensemble" onClick={() => setVb({ x: 0, y: 0, w: W, h: H })}>
            ⤢
          </button>
        </div>
      </div>

      <section className="card stack" aria-live="polite" aria-labelledby="reg">
        <div className="row-between">
          <h2 id="reg">{regionOpen ? region.name : `Région mystérieuse`}</h2>
          <span className="tag">
            Niv. {region.minLevel}–{region.maxLevel}
          </span>
        </div>
        {regionOpen ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              {region.description}
            </p>
            {unlocked[region.id] && <p className="tiny" style={{ margin: 0 }}>Découverte le {formatDateShort(unlocked[region.id])} — elle reste à toi pour toujours.</p>}
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Un léger brouillard couvre cette région. Elle se révélera au niveau {region.minLevel}, grâce à tes bonnes habitudes (pas à tes montants).
          </p>
        )}
        <h3 className="small">Objets à collectionner</h3>
        <div className="badge-grid">
          {region.collectibles.map((c) => {
            const got = lp.level >= c.level;
            return (
              <div key={c.id} className={`badge-item ${got ? '' : 'locked'}`}>
                <div className="medal" aria-hidden>
                  {got ? c.icon : '?'}
                </div>
                <strong>{got ? c.name : '???'}</strong>
                <span className="tiny">{got ? c.description : `Niveau ${c.level}`}</span>
              </div>
            );
          })}
        </div>
        {MISSIONS.some((m) => m.region === region.id) && (
          <>
            <h3 className="small">Missions de la région</h3>
            {missions
              .filter((m) => m.mission.region === region.id)
              .map((m) => (
                <div key={m.mission.id} className="row small">
                  <span aria-hidden>{m.done ? '✅' : m.active ? '🧭' : '💤'}</span>
                  <div className="grow">
                    <div>{m.mission.title}</div>
                    <div className="tiny">
                      {m.mission.description}
                      {m.progressLabel ? ` · ${m.progressLabel}` : ''}
                      {m.mission.repeat === 'period' ? ' · chaque mois' : ''}
                    </div>
                  </div>
                  <span className={`tag ${m.done ? 'tag-ok' : 'tag-gold'}`}>{m.done ? 'Terminée' : `+${m.mission.xp} XP`}</span>
                </div>
              ))}
          </>
        )}
      </section>

      <section className="card" aria-labelledby="rlist">
        <div className="card-head">
          <h2 id="rlist">Toutes les régions</h2>
        </div>
        <div className="list">
          {REGIONS.map((r) => (
            <button key={r.id} type="button" className="list-row" aria-pressed={sel === r.id} onClick={() => setSel(r.id)}>
              <span className="icon-bubble" style={{ background: r.color }} aria-hidden>
                {isOpen(r) ? '🗺️' : '🔒'}
              </span>
              <div className="grow">
                <div>{isOpen(r) ? r.name : 'Région mystérieuse'}</div>
                <div className="tiny">
                  Niveaux {r.minLevel} à {r.maxLevel} · {isOpen(r) ? 'débloquée' : `à partir du niveau ${r.minLevel}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="card stack" aria-labelledby="mhist">
        <h2 id="mhist">Missions terminées</h2>
        {data.progress.missionCompletions.length === 0 ? (
          <p className="small muted">Aucune pour l’instant — la première est toute proche !</p>
        ) : (
          [...data.progress.missionCompletions]
            .reverse()
            .slice(0, 15)
            .map((c) => (
              <div key={c.missionId + c.period} className="row-between small">
                <span>✅ {MISSIONS.find((m) => m.id === c.missionId)?.title}</span>
                <span className="tiny">{formatDateShort(c.date)}</span>
              </div>
            ))
        )}
      </section>
    </div>
  );
}
