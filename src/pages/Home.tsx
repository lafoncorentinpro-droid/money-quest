import { addDays, formatDateShort, periodLabel, periodRange } from '../domain/dates';
import { monthProgress, monthSummary } from '../domain/finance';
import { percent } from '../domain/money';
import { periodStatus, scheduleLabel } from '../domain/recurring';
import { useStore } from '../store/store';
import { CatIcon } from '../ui/CatIcon';
import { useCountUp } from '../ui/components';
import { Icon } from '../ui/Icon';
import { Mascot } from '../ui/Mascot';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';
import { buildRows, OpRowView } from './operations';

/** Accueil « Mon QG » (maquette 01-Accueil). */
export function Home() {
  const { data, period, today, money } = useStore();
  const open = useSheets();
  const s = monthSummary(data, period);
  const shown = useCountUp(s.available);
  const range = periodRange(period, 1);
  const prog = monthProgress(data, period, today);
  const used = s.incomesReceived > 0 ? Math.min(100, percent(s.expensesRealized, s.incomesReceived)) : 0;

  // Dernières opérations : 3 réalisées + 1 échéance à venir dans la semaine
  const rows = buildRows(data, range, true);
  const done = rows.filter((r) => !r.planned && !r.cancelled).sort((a, b) => b.date.localeCompare(a.date));
  const soon = rows.filter((r) => r.planned && r.date >= today && r.date <= addDays(today, 7)).sort((a, b) => a.date.localeCompare(b.date));
  const recent = [...done.slice(0, soon.length ? 3 : 4), ...soon.slice(0, 1)];
  const dayLabel = (d: string) => (d === today ? 'Aujourd’hui' : d === addDays(today, -1) ? 'Hier' : formatDateShort(d));

  const recurring = data.recurring.filter((r) => r.kind === 'expense' && r.active).sort((a, b) => a.startDate.slice(8).localeCompare(b.startDate.slice(8)));

  return (
    <div className="page home">
      <header className="home-head">
        <div>
          <div className="home-month">{periodLabel(period, 1)}</div>
          <h1 className="home-title">Mon QG</h1>
        </div>
        <button type="button" className="round-btn" onClick={() => go('reglages')} aria-label="Réglages">
          <Icon name="sliders" size={21} strokeWidth={2} />
        </button>
      </header>

      <section className="hero-card" aria-labelledby="dispo">
        <div className="hero-mascot">
          <Mascot id={data.settings.mascot} size={112} hello animate={data.settings.animations} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <h2 id="dispo" className="hero-label">
            Il te reste ce mois
          </h2>
          <span className="hero-tag">Estimation</span>
        </div>
        <div className={`hero-big num ${s.available < 0 ? 'is-neg' : ''}`}>{money(shown)}</div>
        <div className="hero-bar" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={100} aria-label="Budget utilisé">
          <span style={{ width: `${used}%` }} />
        </div>
        <div className="row-between hero-small">
          <span>{used} % du budget utilisé</span>
          <span>{prog.day >= prog.days ? 'Mois terminé' : `Jour ${prog.day} sur ${prog.days}`}</span>
        </div>
        <div className="hero-tiles">
          <div>
            <span>Budget de base</span>
            <strong className="num">{money(s.incomesReceived)}</strong>
          </div>
          <div>
            <span>Dépensé</span>
            <strong className="num">{money(s.expensesRealized)}</strong>
          </div>
        </div>
        <button type="button" className="hero-btn" onClick={() => go('graphiques')}>
          <Icon name="chart" size={20} strokeWidth={2} /> Bilan du mois
        </button>
      </section>

      <div className="action-tiles">
        <button type="button" className="action-tile is-primary" onClick={() => open({ kind: 'expense' })}>
          <span className="action-ico">
            <Icon name="card" size={22} />
          </span>
          Dépense
        </button>
        <button type="button" className="action-tile" onClick={() => open({ kind: 'recurring', recKind: 'expense' })}>
          <span className="action-ico">
            <Icon name="repeat" size={22} />
          </span>
          Récurrente
        </button>
        <button type="button" className="action-tile" onClick={() => open({ kind: 'income' })}>
          <span className="action-ico">
            <Icon name="arrow-down-circle" size={22} />
          </span>
          Budget de base
        </button>
      </div>

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
          <div className="list">
            {recent.map((r) => (
              <OpRowView key={r.key} row={r} money={money} onOpen={open} dateLabel={dayLabel(r.date)} />
            ))}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="recdep">
        <div className="card-head">
          <h2 id="recdep">Dépenses récurrentes</h2>
          <button type="button" className="link" onClick={() => open({ kind: 'recurring', recKind: 'expense' })}>
            + Ajouter
          </button>
        </div>
        {recurring.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>Aucune pour l’instant : loyer, abonnements, forfait…</p>
        ) : (
          <div className="list">
            {recurring.map((r) => {
              const st = periodStatus(data, r, range);
              return (
                <div key={r.id} className="list-row op-row">
                  <button type="button" className="rec-main" onClick={() => open({ kind: 'recurring', id: r.id })}>
                    <CatIcon id={r.categoryId} fallback={data.categories.find((c) => c.id === r.categoryId)?.icon} size={42} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="op-title ellipsis">{r.description}</span>
                      <span className="op-sub ellipsis">{scheduleLabel(r)}</span>
                    </span>
                  </button>
                  <div className="rec-side">
                    <span className="op-amount num">{money(r.amount)}</span>
                    {st.confirmed ? (
                      <span className="paid-chip">
                        <Icon name="check" size={14} strokeWidth={2.4} /> Payé
                      </span>
                    ) : st.date ? (
                      <button type="button" className="pay-btn" onClick={() => open({ kind: 'occurrence', rec: r, date: st.date! })}>
                        Payé ?
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="tiny" style={{ margin: '12px 0 0' }}>
          Rien n’est compté tout seul : tu confirmes chaque échéance avec « Payé ? ».
        </p>
      </section>
    </div>
  );
}
