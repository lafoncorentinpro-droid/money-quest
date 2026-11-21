import { addDays, formatDateLong, formatDateShort, periodLabel, periodRange } from '../domain/dates';
import { monthSummary, recentByDay } from '../domain/finance';
import { pendingOccurrences } from '../domain/recurring';
import { useStore } from '../store/store';
import { useCountUp } from '../ui/components';
import { Icon } from '../ui/Icon';
import { Mascot } from '../ui/Mascot';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';
import { buildRows, OpRowView } from './operations';

/** Accueil : tout tient sur un écran d'iPhone (375 × 812). */
export function Home() {
  const { data, period, today, money } = useStore();
  const open = useSheets();
  const s = monthSummary(data, period);
  const shown = useCountUp(s.available);
  const catName = (id: string) => data.categories.find((c) => c.id === id);

  const due = data.settings.alerts.echeances ? pendingOccurrences(data, { start: addDays(today, -31), end: addDays(today, 7) }).slice(0, 2) : [];

  // 3 dernières opérations, groupées par jour
  let left = due.length ? 2 : 3;
  const recent = recentByDay(buildRows(data, periodRange(period, 1), false), 3)
    .map((d) => {
      const items = d.items.slice(0, Math.max(0, left));
      left -= items.length;
      return { ...d, items };
    })
    .filter((d) => d.items.length > 0);

  return (
    <div className="page home">
      <header className="row-between">
        <div className="row" style={{ gap: 10 }}>
          <Mascot id={data.settings.mascot} size={48} hello animate={data.settings.animations} />
          <div>
            <div className="tiny" style={{ textTransform: 'capitalize' }}>
              {periodLabel(period, 1)}
            </div>
            <h1 style={{ fontFamily: 'var(--font-title)', margin: 0, fontSize: 24 }}>Mon QG</h1>
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={() => go('reglages')} aria-label="Réglages">
          <Icon name="gear" size={24} />
        </button>
      </header>

      <section className="card stack home-hero" aria-labelledby="dispo">
        <div className="row-between">
          <h2 id="dispo" className="small muted" style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>
            Il te reste ce mois
          </h2>
          <button type="button" className="link" onClick={() => go('graphiques')}>
            📊 Bilan
          </button>
        </div>
        <div className={`hero-amount num ${s.available < 0 ? 'neg' : ''}`}>{money(shown)}</div>
        <div className="grid-2">
          <div className="stat">
            <div className="label">Budget de base</div>
            <div className="value num">{money(s.incomesReceived)}</div>
          </div>
          <div className="stat">
            <div className="label">Dépensé</div>
            <div className="value num">{money(s.expensesRealized)}</div>
          </div>
        </div>
      </section>

      <div className="quick-actions">
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'expense' })}>
          <Icon name="card" size={24} />
          <span>Dépense</span>
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'recurring', recKind: 'expense' })}>
          <Icon name="repeat" size={24} />
          <span>Dépense récurrente</span>
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'income' })}>
          <Icon name="arrow-down-circle" size={24} />
          <span>Budget de base</span>
        </button>
      </div>

      {due.length > 0 && (
        <section className="card" aria-labelledby="ech">
          <div className="card-head">
            <h2 id="ech">À confirmer</h2>
            <button type="button" className="link" onClick={() => go('argent')}>
              Tout voir
            </button>
          </div>
          <div className="list">
            {due.map((u) => (
              <div key={u.rec.id + u.date} className="list-row planned-row">
                <span className="icon-bubble" aria-hidden>
                  {u.rec.kind === 'income' ? '💧' : catName(u.rec.categoryId ?? '')?.icon ?? '🔁'}
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis">{u.rec.description}</div>
                  <div className="tiny">{u.date < today ? <span className="neg">Depuis le {formatDateShort(u.date)}</span> : `Le ${formatDateShort(u.date)}`}</div>
                </div>
                <button type="button" className="btn btn-sm btn-soft" onClick={() => open({ kind: 'occurrence', rec: u.rec, date: u.date })}>
                  {u.rec.kind === 'income' ? 'Reçu ?' : 'Payé ?'} {money(u.rec.amount)}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="recent">
        <div className="card-head">
          <h2 id="recent">Dernières opérations</h2>
          <button type="button" className="link" onClick={() => go('argent/operations')}>
            Tout voir
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>Rien de noté ce mois-ci pour l’instant.</p>
        ) : (
          recent.map((d) => (
            <div key={d.date}>
              <div className="day-head row-between tiny">
                <span style={{ textTransform: 'capitalize' }}>{d.date === today ? 'Aujourd’hui' : formatDateLong(d.date)}</span>
                <span className={`num ${d.net > 0 ? 'pos' : ''}`}>
                  {d.net > 0 ? '+' : d.net < 0 ? '−' : ''}
                  {money(Math.abs(d.net))}
                </span>
              </div>
              <div className="list">
                {d.items.map((r) => (
                  <OpRowView key={r.key} row={r} money={money} onOpen={open} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
