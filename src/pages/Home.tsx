import { addDays, formatDateLong, formatDateShort, periodLabel, periodRange } from '../domain/dates';
import { monthSummary, recentByDay, type MonthSummary } from '../domain/finance';
import { pendingOccurrences } from '../domain/recurring';
import { useStore } from '../store/store';
import { useCountUp } from '../ui/components';
import { Fox, type FoxMood } from '../ui/Fox';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';
import { Icon } from '../ui/Icon';
import { buildRows, OpRowView } from './operations';

function foxMessage(s: MonthSummary, hasData: boolean, nickname: string): { mood: FoxMood; text: string } {
  const m = foxMessageRaw(s, hasData, nickname);
  return { ...m, text: m.text.charAt(0).toUpperCase() + m.text.slice(1) };
}

function foxMessageRaw(s: MonthSummary, hasData: boolean, nickname: string): { mood: FoxMood; text: string } {
  const hi = nickname ? `${nickname}, ` : '';
  if (!hasData) return { mood: 'accueil', text: `Bienvenue au QG${nickname ? `, ${nickname}` : ''} ! Dès que tu veux noter quelque chose, le bouton + est là.` };
  const over = s.categories.filter((c) => c.state === 'depasse').length;
  if (over > 0) return { mood: 'encourageant', text: `${hi}une catégorie a dépassé sa limite. Ça arrive : regarde ton budget, on ajuste sans stress.` };
  if (s.hasBudget && s.budgetTotal > 0 && s.budgetSpent <= s.budgetTotal) return { mood: 'heureux', text: `${hi}ton budget tient la route. Continue de noter tes dépenses au fil de l’eau !` };
  return { mood: 'exploration', text: `${hi}chaque opération notée éclaire un peu plus la carte. Prêt pour la suite ?` };
}

export function Home() {
  const { data, period, today, money } = useStore();
  const open = useSheets();
  const s = monthSummary(data, period);
  const shown = useCountUp(s.available);
  const hasData = data.incomes.length + data.expenses.length + data.recurring.length + data.movements.length > 0 || Object.keys(data.budgets).length > 0;
  const fox = foxMessage(s, hasData, data.settings.nickname);
  const { alerts } = data.settings;

  const upcoming = pendingOccurrences(data, { start: addDays(today, -31), end: addDays(today, 14) });
  const overdue = upcoming.filter((u) => u.date < today);
  const soon = upcoming.filter((u) => u.date >= today);
  const loggedToday = data.progress.xpEvents.some((e) => e.key === `saisie:${today}`);
  const warnCats = s.categories.filter((c) => c.state !== 'ok');
  const catName = (id: string) => data.categories.find((c) => c.id === id);

  const recent = recentByDay(buildRows(data, periodRange(period, data.settings.monthStartDay), false), 3);

  return (
    <div className="page">
      <header className="row-between">
        <div>
          <div className="tiny" style={{ textTransform: 'capitalize' }}>
            {periodLabel(period, data.settings.monthStartDay)}
          </div>
          <h1 style={{ fontFamily: 'var(--font-title)', margin: 0, fontSize: 26 }}>Mon QG</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => go('reglages')} aria-label="Réglages">
          <Icon name="gear" size={24} />
        </button>
      </header>

      <section className="card stack" aria-labelledby="dispo">
        <div className="row-between">
          <h2 id="dispo" className="small muted" style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>
            Il te reste ce mois
          </h2>
          <span className="tag">Estimation</span>
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
        {(s.incomesPlanned > 0 || s.expensesPlanned > 0) && (
          <div className="notice notice-info small">
            <span aria-hidden>🔮</span>
            <span>
              Prévision de fin de mois : <strong className="num">{money(s.forecast)}</strong> (si {money(s.incomesPlanned)} de budget de base attendu arrive et {money(s.expensesPlanned)} de dépenses
              prévues sont payées).
            </span>
          </div>
        )}
        <button type="button" className="btn btn-soft btn-block" onClick={() => go('graphiques')}>
          📊 Bilan du mois
        </button>
      </section>

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
          <div className="stack">
            {recent.map((d) => (
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
            ))}
          </div>
        )}
      </section>

      <div className="quick-actions">
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'expense' })}>
          <Icon name="card" size={26} />
          <span>Dépense</span>
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'income' })}>
          <Icon name="arrow-down-circle" size={26} />
          <span>Budget de base</span>
        </button>
      </div>

      <div className="fox-bubble">
        <Fox mood={fox.mood} size={84} equipped={data.progress.equipped} animate={data.settings.animations} />
        <div className="speech">{fox.text}</div>
      </div>

      {alerts.rappelSaisie && hasData && !loggedToday && <div className="notice notice-gold small">📝 Rien de noté aujourd’hui pour l’instant. Une dépense ? Le bouton + est là.</div>}

      {alerts.budget && warnCats.length > 0 && (
        <section className="card stack" aria-label="Alertes budget">
          {warnCats.map((c) => (
            <div key={c.categoryId} className={`notice ${c.state === 'depasse' ? 'notice-warn' : 'notice-gold'} small`}>
              <span aria-hidden>{catName(c.categoryId)?.icon}</span>
              <span>
                <strong>{catName(c.categoryId)?.name}</strong> : {c.state === 'depasse' ? 'limite dépassée' : 'proche de la limite'} ({money(c.spent)} sur {money(c.limit)})
              </span>
            </div>
          ))}
        </section>
      )}

      {alerts.echeances && (overdue.length > 0 || soon.length > 0) && (
        <section className="card" aria-labelledby="ech">
          <div className="card-head">
            <h2 id="ech">Échéances</h2>
            <button type="button" className="link" onClick={() => go('argent/recurrences')}>
              Toutes
            </button>
          </div>
          <div className="list">
            {[...overdue, ...soon].slice(0, 6).map((u) => (
              <div key={u.rec.id + u.date} className="list-row planned-row">
                <span className="icon-bubble" aria-hidden>
                  {u.rec.kind === 'income' ? '💧' : catName(u.rec.categoryId ?? '')?.icon ?? '🔁'}
                </span>
                <div className="grow">
                  <div className="ellipsis">{u.rec.description}</div>
                  <div className="tiny">
                    {u.date < today ? <span className="neg">À confirmer · {formatDateShort(u.date)}</span> : formatDateShort(u.date)} · <span className="tag tag-planned">Prévu</span>
                  </div>
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <span className="num">
                    {u.rec.kind === 'income' ? '+' : '−'}
                    {money(u.rec.amount)}
                  </span>
                  <button type="button" className="btn btn-sm btn-soft" onClick={() => open({ kind: 'occurrence', rec: u.rec, date: u.date })}>
                    {u.rec.kind === 'income' ? 'Reçu ?' : 'Payé ?'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
