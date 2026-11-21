import { addDays, formatDateShort, periodLabel } from '../domain/dates';
import { goalBalance, monthSummary, totalSavings, type MonthSummary } from '../domain/finance';
import { levelProgress, missionsView, regionForLevel, totalXp } from '../domain/game';
import { percent } from '../domain/money';
import { pendingOccurrences } from '../domain/recurring';
import { useStore } from '../store/store';
import { Progress } from '../ui/components';
import { Fox, type FoxMood } from '../ui/Fox';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';

export function CalcExplain({ s }: { s: MonthSummary }) {
  const { money } = useStore();
  return (
    <details className="explain">
      <summary>Comment c’est calculé ?</summary>
      <table className="calc-table">
        <tbody>
          {s.carryIn !== 0 && (
            <tr>
              <td>Report du mois précédent</td>
              <td>{money(s.carryIn)}</td>
            </tr>
          )}
          {s.openingBalance !== 0 && (
            <tr>
              <td>Solde de départ</td>
              <td>{money(s.openingBalance)}</td>
            </tr>
          )}
          <tr>
            <td>+ Revenus reçus</td>
            <td>{money(s.incomesReceived)}</td>
          </tr>
          <tr>
            <td>− Dépenses réalisées (nettes)</td>
            <td>{money(s.expensesRealized)}</td>
          </tr>
          <tr>
            <td>− Épargne mise de côté (versements − retraits)</td>
            <td>{money(s.savingsNet)}</td>
          </tr>
          <tr className="total">
            <td>= Disponible estimé</td>
            <td>{money(s.available)}</td>
          </tr>
        </tbody>
      </table>
      <p className="tiny">
        C’est une estimation à partir de ce que tu as saisi : l’application n’est pas reliée à ta banque, ce n’est pas ton solde bancaire. Les opérations prévues et annulées ne sont pas
        comptées.
      </p>
    </details>
  );
}

function foxMessage(s: MonthSummary, hasData: boolean, nickname: string): { mood: FoxMood; text: string } {
  const m = foxMessageRaw(s, hasData, nickname);
  return { ...m, text: m.text.charAt(0).toUpperCase() + m.text.slice(1) };
}

function foxMessageRaw(s: MonthSummary, hasData: boolean, nickname: string): { mood: FoxMood; text: string } {
  const hi = nickname ? `${nickname}, ` : '';
  if (!hasData) return { mood: 'accueil', text: `Bienvenue au QG ! ${hi}on prépare ensemble ton premier mois ? Commence par ton revenu principal.` };
  const over = s.categories.filter((c) => c.state === 'depasse').length;
  if (over > 0) return { mood: 'encourageant', text: `${hi}une catégorie a dépassé sa limite. Ça arrive : regarde ton budget, on ajuste sans stress.` };
  if (s.hasBudget && s.budgetTotal > 0 && s.budgetSpent <= s.budgetTotal) return { mood: 'heureux', text: `${hi}ton budget tient la route. Continue de noter tes dépenses au fil de l’eau !` };
  return { mood: 'exploration', text: `${hi}chaque opération notée éclaire un peu plus la carte. Prêt pour la suite ?` };
}

export function Home() {
  const { data, period, today, money, dispatch } = useStore();
  const open = useSheets();
  const s = monthSummary(data, period);
  const xp = totalXp(data.progress);
  const lp = levelProgress(xp);
  const region = regionForLevel(lp.level);
  const hasData = data.incomes.length + data.expenses.length + data.recurring.length + data.movements.length > 0 || Object.keys(data.budgets).length > 0;
  const fox = foxMessage(s, hasData, data.settings.nickname);
  const { alerts } = data.settings;

  const upcoming = pendingOccurrences(data, { start: addDays(today, -31), end: addDays(today, 14) });
  const overdue = upcoming.filter((u) => u.date < today);
  const soon = upcoming.filter((u) => u.date >= today);
  const missions = missionsView(data, period).filter((m) => m.active && !m.done).slice(0, 3);
  const loggedToday = data.progress.xpEvents.some((e) => e.key === `saisie:${today}`);
  const warnCats = s.categories.filter((c) => c.state !== 'ok');
  const catName = (id: string) => data.categories.find((c) => c.id === id);
  const savings = totalSavings(data);

  const steps = [
    { done: data.recurring.some((r) => r.kind === 'income') || data.incomes.length > 0, label: 'Ajouter ton salaire ou revenu principal', action: () => open({ kind: 'recurring', recKind: 'income' }) },
    { done: data.recurring.some((r) => r.kind === 'expense'), label: 'Programmer tes charges fixes (loyer, abonnements…)', action: () => open({ kind: 'recurring', recKind: 'expense' }) },
    { done: !!data.budgets[period]?.categories.length, label: 'Préparer le budget du mois', action: () => go('argent/budget') }
  ];
  const showOnboarding = !data.settings.onboardingDone && steps.some((st) => !st.done);

  return (
    <div className="page">
      <header className="row-between">
        <div>
          <div className="tiny" style={{ textTransform: 'capitalize' }}>
            {periodLabel(period, data.settings.monthStartDay)}
          </div>
          <h1 style={{ fontFamily: 'var(--font-title)', margin: 0, fontSize: 26 }}>Mon QG</h1>
        </div>
        <button type="button" className="chip" onClick={() => go('monde')} aria-label={`Niveau ${lp.level}, voir le monde`}>
          ⭐ Niv. {lp.level}
        </button>
      </header>

      <div className="fox-bubble">
        <Fox mood={fox.mood} size={84} equipped={data.progress.equipped} animate={data.settings.animations} />
        <div className="speech">{fox.text}</div>
      </div>

      {showOnboarding && (
        <section className="card card-accent stack" aria-labelledby="onb">
          <h2 id="onb">Pour bien démarrer</h2>
          <ol className="stack" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {steps.map((st, i) => (
              <li key={i}>
                <button type="button" className="btn btn-block" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={st.action} disabled={st.done}>
                  <span aria-hidden>{st.done ? '✅' : `${i + 1}.`}</span> {st.label}
                  {st.done && <span className="sr-only"> (fait)</span>}
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="link" onClick={() => dispatch({ type: 'settings/update', settings: { onboardingDone: true } })}>
            Masquer ce guide
          </button>
        </section>
      )}

      <section className="card stack" aria-labelledby="dispo">
        <div className="row-between">
          <h2 id="dispo" className="small muted" style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>
            Disponible estimé ce mois
          </h2>
          <span className="tag">Estimation</span>
        </div>
        <div className={`hero-amount num ${s.available < 0 ? 'neg' : ''}`}>{money(s.available)}</div>
        <div className="grid-2">
          <div className="stat">
            <div className="label">Revenus reçus</div>
            <div className="value num">{money(s.incomesReceived)}</div>
          </div>
          <div className="stat">
            <div className="label">Dépenses réalisées</div>
            <div className="value num">{money(s.expensesRealized)}</div>
          </div>
          <div className="stat">
            <div className="label">Mis de côté ce mois</div>
            <div className="value num">{money(s.savingsNet)}</div>
          </div>
          <div className="stat">
            <div className="label">Épargne totale</div>
            <div className="value num">{money(savings)}</div>
          </div>
        </div>
        {(s.incomesPlanned > 0 || s.expensesPlanned > 0) && (
          <div className="notice notice-info small">
            <span aria-hidden>🔮</span>
            <span>
              Prévision de fin de mois : <strong className="num">{money(s.forecast)}</strong> (si {money(s.incomesPlanned)} de revenus attendus arrivent et {money(s.expensesPlanned)} de dépenses
              prévues sont payées).
            </span>
          </div>
        )}
        <CalcExplain s={s} />
      </section>

      <div className="quick-actions">
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'expense' })}>
          <span aria-hidden>🪙</span>
          <span>Dépense</span>
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'income' })}>
          <span aria-hidden>💧</span>
          <span>Revenu</span>
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'movement' })}>
          <span aria-hidden>🧰</span>
          <span>Épargne</span>
        </button>
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

      {s.hasBudget && s.budgetTotal > 0 && (
        <section className="card stack" aria-labelledby="bud">
          <div className="row-between">
            <h2 id="bud">Budget du mois</h2>
            <button type="button" className="link" onClick={() => go('argent/budget')}>
              Détails
            </button>
          </div>
          <Progress value={s.budgetSpent} max={s.budgetTotal} tone={s.budgetSpent > s.budgetTotal ? 'depasse' : percent(s.budgetSpent, s.budgetTotal) >= 80 ? 'proche' : 'ok'} label="Budget utilisé" />
          <div className="row-between small">
            <span className="num">
              {money(s.budgetSpent)} / {money(s.budgetTotal)}
            </span>
            <span className="muted num">Reste {money(s.budgetTotal - s.budgetSpent)}</span>
          </div>
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

      <section className="card stack" aria-labelledby="xp">
        <div className="row-between">
          <h2 id="xp">Niveau {lp.level}</h2>
          <span className="tiny">{region.name}</span>
        </div>
        <Progress value={lp.into} max={lp.needed || 1} tone="xp" label="Progression vers le niveau suivant" />
        <div className="tiny">{lp.needed ? `${lp.into} / ${lp.needed} XP vers le niveau ${lp.level + 1}` : 'Niveau maximum atteint !'}</div>
        {missions.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <h3 className="small muted">Missions en cours</h3>
            {missions.map((m) => (
              <div key={m.mission.id} className="row small">
                <span aria-hidden>🧭</span>
                <span className="grow">
                  {m.mission.title}
                  {m.progressLabel && <span className="tiny"> · {m.progressLabel}</span>}
                </span>
                <span className="tag tag-gold">+{m.mission.xp} XP</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="link" onClick={() => go('monde')}>
          Explorer le monde →
        </button>
      </section>

      {data.goals.length > 0 && (
        <section className="card" aria-labelledby="gl">
          <div className="card-head">
            <h2 id="gl">Mes trésors</h2>
            <button type="button" className="link" onClick={() => go('tresors')}>
              Voir
            </button>
          </div>
          <div className="stack">
            {data.goals
              .filter((g) => !g.paused)
              .slice(0, 3)
              .map((g) => {
                const bal = goalBalance(g.id, data.movements);
                return (
                  <button key={g.id} type="button" className="list-row" style={{ border: 'none', padding: 0, minHeight: 0 }} onClick={() => go(`tresors/${g.id}`)}>
                    <span className="icon-bubble" aria-hidden>
                      {g.icon}
                    </span>
                    <div className="grow stack" style={{ gap: 4 }}>
                      <div className="row-between small">
                        <span className="ellipsis">{g.name}</span>
                        <span className="num muted">{percent(bal, g.target)} %</span>
                      </div>
                      <Progress value={bal} max={g.target} tone={bal >= g.target ? 'ok' : undefined} label={`Progression ${g.name}`} />
                    </div>
                  </button>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
