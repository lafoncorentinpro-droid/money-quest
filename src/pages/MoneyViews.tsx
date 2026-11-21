import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  addDays,
  addMonthsClamped,
  daysInMonth,
  formatDateLong,
  formatDateShort,
  isValidISO,
  isValidPeriod,
  makeISO,
  monthName,
  parseISO,
  parsePeriod,
  periodLabel,
  periodOf,
  periodRange,
  periodShort,
  periodsBetween,
  shiftPeriod,
  weekdayMon
} from '../domain/dates';
import {
  buildBilan,
  goalBalance,
  monthlyNeeded,
  monthSummary,
  monthsToReach,
  rangeStats,
  seriesByPeriod,
  suggestedCarryOver,
  totalSavings
} from '../domain/finance';
import { centsToInput, parseAmount, percent } from '../domain/money';
import { FREQUENCY_LABEL, nextDue, pendingOccurrences } from '../domain/recurring';
import type { DateRange, PeriodKey } from '../domain/types';
import { useStore } from '../store/store';
import { AmountField, Confirm, Empty, Field, PageHead, PeriodSwitcher, Progress, StateTag, Switch, useAmount } from '../ui/components';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';
import { buildRows, OpRowView } from './operations';
import { MonthStrip, StepNav } from './Month';
import { Icon } from '../ui/Icon';

/* ============================== BUDGET ============================== */

export function BudgetPage() {
  const { data, month: period, setMonth: setPeriod } = useStore();
  return (
    <>
      <PeriodSwitcher period={period} onChange={setPeriod} startDay={data.settings.monthStartDay} />
      <BudgetEditor key={period} period={period} />
    </>
  );
}

function BudgetEditor({ period }: { period: PeriodKey }) {
  const { data, dispatch, money, toast } = useStore();
  const budget = data.budgets[period];
  const s = monthSummary(data, period);
  const prevBudget = data.budgets[shiftPeriod(period, -1)];
  const cats = data.categories.filter((c) => !c.archived);
  const initial = () => Object.fromEntries((budget?.categories ?? []).map((c) => [c.categoryId, centsToInput(c.limit)]));
  const [limits, setLimits] = useState<Record<string, string>>(initial);
  const [savings, setSavings] = useState(budget?.savingsTarget ? centsToInput(budget.savingsTarget) : '');
  const [dirty, setDirty] = useState(false);
  const [carryConfirm, setCarryConfirm] = useState(false);
  const spentBy = Object.fromEntries(s.categories.map((c) => [c.categoryId, c]));
  const prevAvailable = suggestedCarryOver(data, period);
  const invalid = Object.values(limits).some((t) => t.trim() !== '' && parseAmount(t) === null) || (savings.trim() !== '' && parseAmount(savings) === null);

  const save = () => {
    if (invalid) {
      toast('Un des montants est invalide.', 'error');
      return;
    }
    const categories = Object.entries(limits)
      .map(([categoryId, t]) => ({ categoryId, limit: parseAmount(t) ?? 0 }))
      .filter((c) => c.limit > 0);
    if (dispatch({ type: 'budget/save', budget: { period, categories, savingsTarget: parseAmount(savings) ?? 0 } })) {
      setDirty(false);
      toast('Budget enregistré', 'success');
    }
  };

  const copyPrev = () => {
    if (!prevBudget) return;
    setLimits(Object.fromEntries(prevBudget.categories.map((c) => [c.categoryId, centsToInput(c.limit)])));
    setSavings(prevBudget.savingsTarget ? centsToInput(prevBudget.savingsTarget) : '');
    setDirty(true);
    toast('Budget du mois précédent copié : vérifie puis enregistre.');
  };

  const draftTotal = Object.values(limits).reduce((a, t) => a + (parseAmount(t) ?? 0), 0);

  return (
    <>
      <section className="card stack" aria-labelledby="bsum">
        <h2 id="bsum">Vue d’ensemble</h2>
        <div className="grid-2">
          <div className="stat">
            <div className="label">Budget prévu</div>
            <div className="value num">{money(s.budgetTotal)}</div>
          </div>
          <div className="stat">
            <div className="label">Réalisé à date</div>
            <div className="value num">{money(s.budgetSpent)}</div>
          </div>
          <div className="stat">
            <div className="label">Montant restant</div>
            <div className={`value num ${s.budgetTotal - s.budgetSpent < 0 ? 'neg' : ''}`}>{money(s.budgetTotal - s.budgetSpent)}</div>
          </div>
          <div className="stat">
            <div className="label">Reste à vivre estimé</div>
            <div className={`value num ${s.resteAVivre < 0 ? 'neg' : ''}`}>{money(s.resteAVivre)}</div>
          </div>
        </div>
        <details className="explain">
          <summary>Détail du reste à vivre</summary>
          <table className="calc-table">
            <tbody>
              <tr>
                <td>Revenus reçus</td>
                <td>{money(s.incomesReceived)}</td>
              </tr>
              <tr>
                <td>+ Revenus attendus (prévus)</td>
                <td>{money(s.incomesPlanned)}</td>
              </tr>
              <tr>
                <td>− Charges fixes payées</td>
                <td>{money(s.fixedRealized)}</td>
              </tr>
              <tr>
                <td>− Charges fixes prévues</td>
                <td>{money(s.fixedPlanned)}</td>
              </tr>
              <tr>
                <td>− Objectif d’épargne du mois</td>
                <td>{money(s.savingsTarget)}</td>
              </tr>
              <tr className="total">
                <td>= Pour les dépenses variables</td>
                <td>{money(s.resteAVivre)}</td>
              </tr>
            </tbody>
          </table>
          <p className="tiny">Estimation : les montants prévus peuvent changer.</p>
        </details>
        {s.savingsTarget > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="row-between small">
              <span>Objectif d’épargne</span>
              <span className="num">
                {money(s.savingsNet)} / {money(s.savingsTarget)}
              </span>
            </div>
            <Progress value={s.savingsNet} max={s.savingsTarget} tone={s.savingsNet >= s.savingsTarget ? 'ok' : undefined} label="Objectif d’épargne du mois" />
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="carry">
        <h2 id="carry">Report du mois précédent</h2>
        {budget?.carryOver ? (
          <>
            <div className="notice notice-info small">
              <span aria-hidden>↪︎</span>
              <span>
                <strong className="num">{money(budget.carryOver.amount)}</strong> reporté depuis {periodLabel(budget.carryOver.fromPeriod, data.settings.monthStartDay)}, le{' '}
                {formatDateShort(budget.carryOver.recordedAt.slice(0, 10))}. Il est inclus dans le disponible estimé de ce mois.
              </span>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'budget/clearCarryOver', period })}>
              Annuler le report
            </button>
          </>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              Aucun report n’est fait automatiquement. Le disponible estimé de {periodLabel(shiftPeriod(period, -1), data.settings.monthStartDay)} est de{' '}
              <strong className="num">{money(prevAvailable)}</strong> ({prevAvailable >= 0 ? 'surplus' : 'déficit'}).
            </p>
            {prevAvailable !== 0 && (
              <button type="button" className="btn btn-sm btn-soft" onClick={() => setCarryConfirm(true)}>
                Reporter {money(prevAvailable)} sur ce mois
              </button>
            )}
          </>
        )}
      </section>

      <section className="card stack" aria-labelledby="cats">
        <div className="row-between">
          <h2 id="cats">Limites par catégorie</h2>
          {prevBudget && (
            <button type="button" className="btn btn-sm" onClick={copyPrev}>
              Copier mois préc.
            </button>
          )}
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          Laisse vide les catégories que tu ne veux pas budgéter. Modifier un budget ne change aucune opération.
        </p>
        <div className="list">
          {cats.map((c) => {
            const line = spentBy[c.id];
            const t = limits[c.id] ?? '';
            const bad = t.trim() !== '' && parseAmount(t) === null;
            return (
              <div key={c.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                <span className="icon-bubble" aria-hidden>
                  {c.icon}
                </span>
                <div className="grow">
                  <div className="ellipsis">{c.name}</div>
                  {line && (
                    <div className="row small" style={{ gap: 6 }}>
                      <span className="num muted">{money(line.spent)} dépensés</span>
                      <StateTag state={line.state} />
                    </div>
                  )}
                </div>
                <input
                  className="input num"
                  style={{ width: 110, textAlign: 'right' }}
                  inputMode="decimal"
                  placeholder="—"
                  aria-label={`Limite ${c.name}`}
                  aria-invalid={bad}
                  value={t}
                  onChange={(e) => {
                    setLimits({ ...limits, [c.id]: e.target.value });
                    setDirty(true);
                  }}
                />
                {line && line.limit > 0 && (
                  <div style={{ width: '100%' }}>
                    <Progress value={line.spent} max={line.limit} tone={line.state} label={`Budget ${c.name}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Field label="Objectif d’épargne du mois (facultatif)" hint="Choisis un montant réaliste : même petit, il compte.">
          <input
            className="input"
            inputMode="decimal"
            placeholder="0,00 €"
            value={savings}
            onChange={(e) => {
              setSavings(e.target.value);
              setDirty(true);
            }}
          />
        </Field>
        <div className="row-between small">
          <span className="muted">Total des limites</span>
          <strong className="num">{money(draftTotal)}</strong>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={!dirty}>
          {dirty ? 'Enregistrer le budget' : budget ? 'Budget enregistré ✓' : 'Saisis des limites'}
        </button>
      </section>

      <ChallengeCard period={period} />

      <button type="button" className="btn btn-block" onClick={() => go(`argent/bilan/${period}`)}>
        📜 Voir le bilan de ce mois
      </button>

      {carryConfirm && (
        <Confirm
          title="Reporter le solde ?"
          message={`${money(prevAvailable)} sera ajouté (ou retiré s’il est négatif) au disponible estimé de ${periodLabel(period, data.settings.monthStartDay)}. Le report est tracé et peut être annulé.`}
          onCancel={() => setCarryConfirm(false)}
          onConfirm={() => {
            dispatch({ type: 'budget/carryOver', period, amount: prevAvailable, fromPeriod: shiftPeriod(period, -1) });
            setCarryConfirm(false);
            toast('Report enregistré', 'success');
          }}
        />
      )}
    </>
  );
}

function ChallengeCard({ period }: { period: PeriodKey }) {
  const { data, dispatch, money, toast, period: current } = useStore();
  const ch = data.progress.categoryChallenge;
  const [cat, setCat] = useState('restaurants');
  const amount = useAmount();
  if (!data.settings.activeMissions.includes('limite-categorie') || period !== current) return null;
  return (
    <section className="card stack" aria-labelledby="chal">
      <h2 id="chal">🎯 Défi du mois (facultatif)</h2>
      {ch && ch.period === period ? (
        <>
          <p className="small" style={{ margin: 0 }}>
            Garder <strong>{data.categories.find((c) => c.id === ch.categoryId)?.name}</strong> sous <strong className="num">{money(ch.limit)}</strong> ce mois-ci. Validé automatiquement à la fin du
            mois.
          </p>
          <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'challenge/clear' })}>
            Abandonner le défi (sans pénalité)
          </button>
        </>
      ) : (
        <>
          <p className="tiny" style={{ margin: 0 }}>
            Choisis toi-même une catégorie et une limite qui te semble réaliste.
          </p>
          <div className="grid-2" style={{ alignItems: 'end' }}>
            <Field label="Catégorie">
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
                {data.categories
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <AmountField label="Limite" amount={amount} />
          </div>
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => {
              amount.setTouched(true);
              if (!amount.valid) return;
              dispatch({ type: 'challenge/set', period, categoryId: cat, limit: amount.cents! });
              toast('Défi accepté !', 'success');
            }}
          >
            Relever ce défi
          </button>
        </>
      )}
    </section>
  );
}

/* ============================== RÉCURRENCES ============================== */

export function RecurringPage() {
  const { data, dispatch, money, today, period, toast } = useStore();
  const open = useSheets();
  const cat = new Map(data.categories.map((c) => [c.id, c]));
  const range = periodRange(period, data.settings.monthStartDay);
  const pending = pendingOccurrences(data, { start: addDays(range.start, -62), end: range.end });
  const reviewed = data.progress.recurringReviews.includes(period);
  const incomes = data.recurring.filter((r) => r.kind === 'income');
  const expenses = data.recurring.filter((r) => r.kind === 'expense');

  const renderList = (list: typeof data.recurring, title: string) => (
    <section className="card" aria-label={title}>
      <div className="card-head">
        <h2>{title}</h2>
      </div>
      {list.length === 0 ? (
        <p className="small muted">Aucune pour l’instant.</p>
      ) : (
        <div className="list">
          {list.map((r) => {
            const next = nextDue(data, r, today);
            return (
              <div key={r.id} className="list-row">
                <span className="icon-bubble" aria-hidden>
                  {r.kind === 'income' ? '💧' : cat.get(r.categoryId ?? '')?.icon ?? '🔁'}
                </span>
                <button type="button" className="grow" style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, minWidth: 0 }} onClick={() => open({ kind: 'recurring', id: r.id })}>
                  <div className="ellipsis">{r.description}</div>
                  <div className="tiny">
                    {FREQUENCY_LABEL[r.frequency]} · {r.active ? (next ? `prochaine le ${formatDateShort(next)}` : 'terminée') : 'suspendue'}
                  </div>
                </button>
                <span className="num">{money(r.amount)}</span>
                <span className="switch" title={r.active ? 'Active' : 'Suspendue'}>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`${r.description} active`}
                    checked={r.active}
                    onChange={(e) => dispatch({ type: 'recurring/update', recurring: { ...r, active: e.target.checked } })}
                  />
                  <span />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <>
      {pending.length > 0 && (
        <section className="card" aria-labelledby="pend">
          <div className="card-head">
            <h2 id="pend">À confirmer</h2>
            <span className="tag tag-planned">Prévues</span>
          </div>
          <div className="list">
            {pending.map((p) => (
              <div key={p.rec.id + p.date} className="list-row planned-row">
                <div className="grow">
                  <div className="ellipsis">{p.rec.description}</div>
                  <div className={`tiny ${p.date < today ? 'neg' : ''}`}>
                    {p.date < today ? 'Passée · ' : ''}
                    {formatDateLong(p.date)}
                  </div>
                </div>
                <span className="num">{money(p.rec.amount)}</span>
                <button type="button" className="btn btn-sm btn-soft" onClick={() => open({ kind: 'occurrence', rec: p.rec, date: p.date })}>
                  {p.rec.kind === 'income' ? 'Reçu' : 'Payé'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="grid-2">
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'recurring', recKind: 'expense' })}>
          + Charge
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'recurring', recKind: 'income' })}>
          + Revenu
        </button>
      </div>
      {renderList(expenses, 'Charges récurrentes')}
      {renderList(incomes, 'Revenus récurrents')}
      {data.recurring.some((r) => r.skipped.length > 0) && (
        <section className="card stack" aria-label="Échéances ignorées">
          <h2>Échéances ignorées</h2>
          {data.recurring.flatMap((r) =>
            r.skipped.map((d) => (
              <div key={r.id + d} className="row-between small">
                <span>
                  {r.description} · {formatDateShort(d)}
                </span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'recurring/unskip', recurringId: r.id, occurrenceDate: d })}>
                  Rétablir
                </button>
              </div>
            ))
          )}
        </section>
      )}
      {data.recurring.length > 0 && (
        <button
          type="button"
          className="btn btn-block"
          disabled={reviewed}
          onClick={() => {
            dispatch({ type: 'recurring/review', period });
            toast('Merci ! Récurrences vérifiées pour ce mois.', 'success');
          }}
        >
          {reviewed ? '✓ Récurrences vérifiées ce mois-ci' : 'J’ai vérifié mes récurrences'}
        </button>
      )}
    </>
  );
}

/* ============================== CALENDRIER ============================== */

export function CalendarPage() {
  const { data, today, money } = useStore();
  const open = useSheets();
  const t = parseISO(today);
  const [ym, setYm] = useState({ y: t.y, m: t.m });
  const [sel, setSel] = useState(today);
  const range: DateRange = { start: makeISO(ym.y, ym.m, 1), end: makeISO(ym.y, ym.m, daysInMonth(ym.y, ym.m)) };
  const rows = useMemo(() => buildRows(data, range), [data, range.start, range.end]); // eslint-disable-line
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const lead = weekdayMon(range.start);
  const days = Array.from({ length: daysInMonth(ym.y, ym.m) }, (_, i) => makeISO(ym.y, ym.m, i + 1));
  const shift = (n: number) => {
    const d = parseISO(addMonthsClamped(ym.y, ym.m, 1, n));
    setYm({ y: d.y, m: d.m });
  };
  const selRows = byDay.get(sel) ?? [];

  return (
    <>
      <div className="row-between card card-tight">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => shift(-1)} aria-label="Mois précédent">
          <Icon name="chevron-left" />
        </button>
        <strong style={{ textTransform: 'capitalize' }}>
          {monthName(ym.m)} {ym.y}
        </strong>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => shift(1)} aria-label="Mois suivant">
          <Icon name="chevron-right" />
        </button>
      </div>
      <section className="card cal-card" aria-label="Calendrier">
        <div className="cal">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={i} className="cal-wd" aria-hidden>
              {d}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`l${i}`} />
          ))}
          {days.map((d) => {
            const r = byDay.get(d) ?? [];
            const hasIn = r.some((x) => !x.planned && x.sign === '+' && !x.cancelled);
            const hasOut = r.some((x) => !x.planned && x.sign !== '+' && !x.cancelled);
            const hasPlan = r.some((x) => x.planned);
            return (
              <button
                key={d}
                type="button"
                className={`cal-day ${d === today ? 'today' : ''}`}
                aria-pressed={sel === d}
                aria-label={`${formatDateLong(d)}${r.length ? `, ${r.length} opération${r.length > 1 ? 's' : ''}` : ''}`}
                onClick={() => setSel(d)}
              >
                <span>{parseISO(d).d}</span>
                <span className="dots" aria-hidden>
                  {hasIn && <i className="dot dot-in" />}
                  {hasOut && <i className="dot dot-out" />}
                  {hasPlan && <i className="dot dot-plan" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend" style={{ marginTop: 10 }}>
          <span>
            <i style={{ background: 'var(--success)', borderRadius: '50%' }} />
            Entrée confirmée
          </span>
          <span>
            <i style={{ background: 'var(--soft)', borderRadius: '50%' }} />
            Sortie confirmée
          </span>
          <span>
            <i style={{ border: '1.5px solid var(--gold)', borderRadius: '50%' }} />
            Prévu
          </span>
        </div>
      </section>
      <section className="card" aria-label={`Opérations du ${formatDateLong(sel)}`}>
        <div className="card-head">
          <h2 style={{ textTransform: 'capitalize' }}>{formatDateLong(sel)}</h2>
        </div>
        {selRows.length === 0 ? (
          <p className="small muted">Aucune opération ce jour-là.</p>
        ) : (
          <div className="list">
            {selRows.map((r) => (
              <OpRowView key={r.key} row={r} money={money} onOpen={open} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ============================== STATISTIQUES ============================== */

type RangeMode = 'mois' | 'trimestre' | 'annee' | 'perso';

export function StatsPage() {
  const { data, period: current, money, today } = useStore();
  const startDay = data.settings.monthStartDay;
  const [mode, setMode] = useState<RangeMode>('trimestre');
  const [anchor, setAnchor] = useState<PeriodKey>(current);
  const [from, setFrom] = useState(periodRange(shiftPeriod(current, -2), startDay).start);
  const [to, setTo] = useState(today);

  const periods =
    mode === 'mois'
      ? [anchor]
      : mode === 'trimestre'
        ? periodsBetween(shiftPeriod(anchor, -2), anchor)
        : mode === 'annee'
          ? periodsBetween(shiftPeriod(anchor, -11), anchor)
          : isValidISO(from) && isValidISO(to) && from <= to
            ? periodsBetween(periodOf(from, startDay), periodOf(to, startDay)).slice(-24)
            : [current];
  const range: DateRange =
    mode === 'perso' && isValidISO(from) && isValidISO(to) && from <= to
      ? { start: from, end: to }
      : { start: periodRange(periods[0], startDay).start, end: periodRange(periods[periods.length - 1], startDay).end };

  const st = rangeStats(data, range, today);
  const series = seriesByPeriod(data, periods.length > 1 ? periods : periodsBetween(shiftPeriod(anchor, -5), anchor));
  const max = Math.max(1, ...series.flatMap((p) => [p.incomes, p.expenses]));
  const maxSav = Math.max(1, ...series.map((p) => p.savingsTotal));
  const cat = new Map(data.categories.map((c) => [c.id, c]));

  return (
    <>
      <div className="segmented" role="group" aria-label="Période">
        {(
          [
            ['mois', 'Mois'],
            ['trimestre', 'Trimestre'],
            ['annee', '12 mois'],
            ['perso', 'Perso']
          ] as [RangeMode, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'perso' ? (
        <div className="grid-2">
          <Field label="Du">
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Au">
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      ) : (
        <PeriodSwitcher period={anchor} onChange={setAnchor} startDay={startDay} />
      )}
      <p className="tiny center" style={{ margin: 0 }}>
        Du {formatDateLong(range.start)} au {formatDateLong(range.end)}
      </p>

      <div className="grid-2">
        <div className="stat">
          <div className="label">Revenus reçus</div>
          <div className="value num pos">{money(st.incomes)}</div>
        </div>
        <div className="stat">
          <div className="label">Dépenses réalisées</div>
          <div className="value num">{money(st.expenses)}</div>
        </div>
        <div className="stat">
          <div className="label">Épargne nette</div>
          <div className="value num">{money(st.savingsNet)}</div>
        </div>
        <div className="stat">
          <div className="label">Moyenne / jour</div>
          <div className="value num">{money(st.dailyAverage)}</div>
        </div>
      </div>

      <section className="card stack" aria-labelledby="ch1">
        <h2 id="ch1">Revenus et dépenses par mois</h2>
        <div className="bars" aria-hidden>
          {series.map((p) => (
            <div key={p.period} className="bar-col">
              <div className="bar-pair">
                <div className="bar bar-in" style={{ height: `${(p.incomes / max) * 100}%` }} />
                <div className="bar bar-out" style={{ height: `${(p.expenses / max) * 100}%` }} />
              </div>
              <span className="bar-label">{periodShort(p.period)}</span>
            </div>
          ))}
        </div>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--success)' }} />
            Revenus
          </span>
          <span>
            <i style={{ background: 'var(--soft)' }} />
            Dépenses
          </span>
        </div>
        <table className="calc-table small">
          <caption className="sr-only">Valeurs par mois</caption>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Mois</th>
              <th style={{ textAlign: 'right' }}>Revenus</th>
              <th style={{ textAlign: 'right' }}>Dépenses</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.period}>
                <td>{periodShort(p.period)}</td>
                <td style={{ textAlign: 'right' }} className="num">
                  {money(p.incomes)}
                </td>
                <td className="num">{money(p.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card stack" aria-labelledby="ch2">
        <h2 id="ch2">Répartition par catégorie</h2>
        {st.byCategory.length === 0 ? (
          <p className="small muted">Aucune dépense réalisée sur cette période.</p>
        ) : (
          st.byCategory.map((c) => (
            <div key={c.categoryId} className="stack" style={{ gap: 4 }}>
              <div className="row-between small">
                <span>
                  {cat.get(c.categoryId)?.icon} {cat.get(c.categoryId)?.name ?? c.categoryId}
                </span>
                <span className="num">
                  {money(c.amount)} · {percent(c.amount, st.expenses)} %
                </span>
              </div>
              <Progress value={c.amount} max={st.expenses} label={cat.get(c.categoryId)?.name ?? ''} />
            </div>
          ))
        )}
      </section>

      <section className="card stack" aria-labelledby="ch3">
        <h2 id="ch3">Fixes et variables</h2>
        <div className="progress" style={{ height: 16, display: 'flex' }} role="img" aria-label={`Fixes ${money(st.fixed)}, variables ${money(st.variable)}`}>
          <span style={{ width: `${percent(st.fixed, st.expenses)}%`, background: 'var(--night)', borderRadius: 0 }} />
          <span style={{ width: `${st.expenses ? 100 - percent(st.fixed, st.expenses) : 0}%`, background: 'var(--sky)', borderRadius: 0 }} />
        </div>
        <div className="row-between small">
          <span>
            <i className="dot" style={{ display: 'inline-block', background: 'var(--night)' }} /> Fixes <span className="num">{money(st.fixed)}</span>
          </span>
          <span>
            <i className="dot" style={{ display: 'inline-block', background: 'var(--sky)' }} /> Variables <span className="num">{money(st.variable)}</span>
          </span>
        </div>
      </section>

      <section className="card stack" aria-labelledby="ch4">
        <h2 id="ch4">Évolution de l’épargne totale</h2>
        <div className="bars" style={{ height: 110 }} aria-hidden>
          {series.map((p) => (
            <div key={p.period} className="bar-col">
              <div className="bar-pair">
                <div className="bar bar-save" style={{ height: `${(p.savingsTotal / maxSav) * 100}%`, width: '60%', maxWidth: 26 }} />
              </div>
              <span className="bar-label">{periodShort(p.period)}</span>
            </div>
          ))}
        </div>
        <div className="small">
          {series.map((p) => (
            <span key={p.period} className="tag" style={{ marginRight: 4, display: 'inline-block', marginBottom: 4 }}>
              {periodShort(p.period)} : <span className="num">{money(p.savingsTotal)}</span>
            </span>
          ))}
        </div>
      </section>

      {data.goals.length > 0 && (
        <section className="card stack" aria-labelledby="ch5">
          <h2 id="ch5">Progression des objectifs</h2>
          {data.goals.map((g) => {
            const b = goalBalance(g.id, data.movements);
            return (
              <div key={g.id} className="stack" style={{ gap: 4 }}>
                <div className="row-between small">
                  <span>
                    {g.icon} {g.name}
                  </span>
                  <span className="num">
                    {money(b)} / {money(g.target)} ({percent(b, g.target)} %)
                  </span>
                </div>
                <Progress value={b} max={g.target} tone={b >= g.target ? 'ok' : undefined} label={g.name} />
              </div>
            );
          })}
        </section>
      )}

      <section className="card stack" aria-labelledby="ch6">
        <h2 id="ch6">Bilans mensuels</h2>
        <div className="chips wrap" style={{ flexWrap: 'wrap' }}>
          {periodsBetween(shiftPeriod(current, -11), current)
            .reverse()
            .map((p) => (
              <button key={p} type="button" className="chip" onClick={() => go(`argent/bilan/${p}`)}>
                {data.progress.bilansViewed.includes(p) ? '✓ ' : ''}
                {periodShort(p)}
              </button>
            ))}
        </div>
      </section>
    </>
  );
}

/* ============================== BILAN ============================== */

export function BilanPage({ period: arg }: { period?: string }) {
  const { data, month: period, setMonth, money, dispatch, today } = useStore();
  useEffect(() => {
    if (arg && isValidPeriod(arg) && arg !== period) setMonth(arg);
  }, [arg]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    dispatch({ type: 'bilan/view', period });
  }, [period, dispatch]);
  const startDay = data.settings.monthStartDay;
  const b = buildBilan(data, period, money);
  const s = b.current;
  const fl = b.flow;
  const cat = new Map(data.categories.map((c) => [c.id, c]));
  const ended = s.range.end < today;
  const delta = (n: number, invert = false) => {
    if (n === 0) return <span className="tag">=</span>;
    const up = n > 0;
    const good = invert ? !up : up;
    return <span className={`tag ${good ? 'tag-ok' : ''}`}>{up ? '▲' : '▼'} {money(Math.abs(n))}</span>;
  };
  const line = (label: string, value: number, extra?: ReactNode, strong = false) => (
    <div className="row-between">
      <span>{label}</span>
      <span className="row" style={{ gap: 6 }}>
        {strong ? <strong className={`num ${value < 0 ? 'neg' : ''}`}>{money(value)}</strong> : <span className="num">{money(value)}</span>}
        {extra}
      </span>
    </div>
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Mon argent</h1>
      </header>
      <MonthStrip />
      <StepNav active="bilan" />
      {!ended && <div className="notice notice-info small">Ce mois n’est pas encore terminé : le bilan évoluera.</div>}

      <section className="card stack" aria-labelledby="bl-real">
        <h2 id="bl-real">Réel</h2>
        {line('Revenus reçus', fl.incomesReceived, delta(b.incomesDelta))}
        {line('Dépenses payées', fl.expensesPaid, delta(b.expensesDelta, true))}
        {line('Épargne réalisée', fl.savingsNet, delta(fl.savingsNet - b.previousFlow.savingsNet))}
        <div className="calc-lines">
          <div className="row-between total">
            <strong>Reste disponible</strong>
            <strong className={`num ${fl.resteDisponible < 0 ? 'neg' : ''}`}>{money(fl.resteDisponible)}</strong>
          </div>
        </div>
        <div className="row-between">
          <span>Taux d’épargne</span>
          <strong>{fl.savingsRate === null ? '—' : `${fl.savingsRate.toLocaleString('fr-FR')} %`}</strong>
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          Reste disponible = revenus reçus − dépenses payées − versements d’épargne + retraits. Taux d’épargne = épargne réalisée ÷ revenus reçus. Flèches : comparaison avec{' '}
          {periodLabel(shiftPeriod(period, -1), startDay)}.
        </p>
      </section>

      <section className="card stack" aria-labelledby="bl-plan">
        <h2 id="bl-plan">Prévisionnel</h2>
        {line('Revenus prévus (total)', fl.incomesExpected)}
        {line('Dépenses prévues (total)', fl.expensesExpected)}
        {line('dont encore à payer', fl.expensesPlanned)}
        {fl.savingsTarget > 0 && line('Objectif d’épargne', fl.savingsTarget, <span className="tag">{percent(fl.savingsNet, fl.savingsTarget)} %</span>)}
        <p className="tiny" style={{ margin: 0 }}>
          Les montants prévus sont des estimations : ils ne comptent dans le réel qu’une fois reçus ou payés.
        </p>
      </section>

      <section className="card stack" aria-labelledby="bl-cat">
        <h2 id="bl-cat">Répartition des dépenses</h2>
        {b.byCategory.length === 0 ? (
          <p className="small muted">Aucune dépense payée ce mois-ci.</p>
        ) : (
          b.byCategory.map((c, i) => (
            <div key={c.categoryId} className="stack" style={{ gap: 4 }}>
              <div className="row-between small">
                <span>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}
                  {cat.get(c.categoryId)?.icon} {cat.get(c.categoryId)?.name}
                </span>
                <span className="num">
                  {money(c.amount)} · {percent(c.amount, fl.expensesPaid)} %
                </span>
              </div>
              <Progress value={c.amount} max={fl.expensesPaid} label={cat.get(c.categoryId)?.name ?? ''} />
            </div>
          ))
        )}
      </section>

      {data.goals.length > 0 && (
        <section className="card stack">
          <h2>Objectifs</h2>
          {data.goals.map((g) => {
            const end = goalBalance(g.id, data.movements, s.range.end);
            const start = goalBalance(g.id, data.movements, addDays(s.range.start, -1));
            return (
              <div key={g.id} className="row-between small">
                <span>
                  {g.icon} {g.name}
                </span>
                <span className="num">
                  {money(end)} ({end - start >= 0 ? '+' : '−'}
                  {money(Math.abs(end - start))})
                </span>
              </div>
            );
          })}
          <div className="row-between small">
            <strong>Épargne totale fin de mois</strong>
            <strong className="num">{money(totalSavings(data, s.range.end))}</strong>
          </div>
        </section>
      )}

      <section className="card stack">
        <h2>🌿 Points positifs</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }} className="stack">
          {b.positives.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
      {b.ideas.length > 0 && (
        <section className="card stack">
          <h2>🧭 Pistes pour la suite</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }} className="stack">
            {b.ideas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ============================== SIMULATEUR ============================== */

export function SimulatorPage() {
  const { data, period, money, today, dispatch, toast } = useStore();
  const [mode, setMode] = useState<'objectif' | 'achat' | 'exceptionnel'>('objectif');
  const [goalId, setGoalId] = useState(data.goals[0]?.id ?? '');
  const goal = data.goals.find((g) => g.id === goalId);
  const current = goal ? goalBalance(goal.id, data.movements) : 0;
  const monthly = useAmount();
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const price = useAmount();
  const saved = useAmount();
  const exceptional = useAmount();
  const [applyConfirm, setApplyConfirm] = useState<number | null>(null);
  const s = monthSummary(data, period);

  const monthsUntil = (date: string) => {
    if (!isValidISO(date) || date <= today) return 0;
    const a = parsePeriod(periodOf(today, 1));
    const b = parsePeriod(periodOf(date, 1));
    return (b.y - a.y) * 12 + (b.m - a.m);
  };
  const dateAfter = (months: number) => {
    const t = parseISO(today);
    return addMonthsClamped(t.y, t.m, t.d, months);
  };

  const target = mode === 'objectif' ? goal?.target ?? 0 : price.cents ?? 0;
  const base = mode === 'objectif' ? current : saved.cents ?? 0;
  const m = monthly.cents ?? 0;
  const months = target > 0 ? monthsToReach(base, target, m) : null;
  const neededMonths = monthsUntil(targetDate);
  const needed = target > 0 && neededMonths > 0 ? monthlyNeeded(base, target, neededMonths) : null;

  return (
    <>
      <div className="notice notice-gold small">
        <span aria-hidden>🔮</span>
        <span>Simulation : rien n’est enregistré. Hypothèses : versements réguliers, sans intérêts ni imprévus.</span>
      </div>
      <div className="segmented" role="group" aria-label="Type de simulation">
        <button type="button" aria-pressed={mode === 'objectif'} onClick={() => setMode('objectif')}>
          Objectif
        </button>
        <button type="button" aria-pressed={mode === 'achat'} onClick={() => setMode('achat')}>
          Achat
        </button>
        <button type="button" aria-pressed={mode === 'exceptionnel'} onClick={() => setMode('exceptionnel')}>
          Dépense except.
        </button>
      </div>

      {mode === 'exceptionnel' ? (
        <section className="card stack">
          <AmountField label="Montant de la dépense exceptionnelle" amount={exceptional} big />
          <div className="grid-2">
            <div className="stat">
              <div className="label">Disponible estimé actuel</div>
              <div className="value num">{money(s.available)}</div>
            </div>
            <div className="stat">
              <div className="label">Après cette dépense</div>
              <div className={`value num ${s.available - (exceptional.cents ?? 0) < 0 ? 'neg' : ''}`}>{money(s.available - (exceptional.cents ?? 0))}</div>
            </div>
            <div className="stat">
              <div className="label">Prévision fin de mois</div>
              <div className="value num">{money(s.forecast)}</div>
            </div>
            <div className="stat">
              <div className="label">Prévision après</div>
              <div className={`value num ${s.forecast - (exceptional.cents ?? 0) < 0 ? 'neg' : ''}`}>{money(s.forecast - (exceptional.cents ?? 0))}</div>
            </div>
          </div>
          {exceptional.cents && s.resteAVivre > 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Cela représente {percent(exceptional.cents, s.resteAVivre)} % de ton reste à vivre estimé ({money(s.resteAVivre)}).
            </p>
          ) : null}
        </section>
      ) : (
        <section className="card stack">
          {mode === 'objectif' ? (
            data.goals.length ? (
              <Field label="Objectif" hint={goal ? `Déjà épargné : ${money(current)} sur ${money(goal.target)}` : undefined}>
                <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                  {data.goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.icon} {g.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Empty icon="🗺️" title="Aucun objectif">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => go('tresors/nouveau')}>
                  Créer un objectif
                </button>
              </Empty>
            )
          ) : (
            <div className="grid-2">
              <AmountField label="Prix de l’achat" amount={price} />
              <AmountField label="Déjà de côté" amount={saved} allowZero />
            </div>
          )}

          <AmountField label="Si je mets de côté chaque mois…" amount={monthly} />
          {target > 0 && m > 0 && (
            <div className="notice notice-info">
              {months === 0 ? (
                <span>C’est déjà atteint 🎉</span>
              ) : (
                <span>
                  … j’atteins <strong className="num">{money(target)}</strong> dans <strong>{months} mois</strong>, vers le <strong>{formatDateLong(dateAfter(months!))}</strong> (estimation).
                </span>
              )}
            </div>
          )}
          {target > 0 && m > 0 && months !== null && months > 0 && (
            <div className="small">
              {[1, 3, 6, 12]
                .filter((k) => k <= Math.max(months, 1) || k === 1)
                .map((k) => (
                  <span key={k} className="tag" style={{ marginRight: 4 }}>
                    {k} mois : <span className="num">{money(Math.min(target, base + m * k))}</span>
                  </span>
                ))}
            </div>
          )}

          <Field label="Ou : je veux y arriver avant le…">
            <input type="date" className="input" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          {needed !== null && (
            <div className="notice notice-info">
              <span>
                Il faudrait environ <strong className="num">{money(needed)}</strong> par mois pendant {neededMonths} mois.
                {s.resteAVivre > 0 && needed > s.resteAVivre && ' C’est plus que ton reste à vivre estimé : une date plus lointaine serait plus confortable.'}
              </span>
            </div>
          )}
          {(needed ?? m) > 0 && (
            <button type="button" className="btn btn-soft" onClick={() => setApplyConfirm(needed ?? m)}>
              Utiliser {money(needed ?? m)} comme objectif d’épargne de ce mois
            </button>
          )}
        </section>
      )}
      {applyConfirm !== null && (
        <Confirm
          title="Appliquer au budget ?"
          message={`L’objectif d’épargne de ${periodLabel(period, data.settings.monthStartDay)} sera fixé à ${money(applyConfirm)}. Tes limites de catégories ne changent pas.`}
          onCancel={() => setApplyConfirm(null)}
          onConfirm={() => {
            const b = data.budgets[period];
            dispatch({ type: 'budget/save', budget: { period, categories: b?.categories ?? [], savingsTarget: applyConfirm } });
            setApplyConfirm(null);
            toast('Objectif d’épargne du mois mis à jour', 'success');
          }}
        />
      )}
    </>
  );
}

/* ============================== CATÉGORIES ============================== */

export function CategoriesPage() {
  const { data, dispatch } = useStore();
  const open = useSheets();
  const used = new Set(data.expenses.map((e) => e.categoryId));
  return (
    <div className="page">
      <PageHead title="Catégories" backTo="argent" />
      <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'category' })}>
        + Nouvelle catégorie
      </button>
      <section className="card">
        <div className="list">
          {data.categories.map((c) => (
            <div key={c.id} className="list-row" style={{ opacity: c.archived ? 0.6 : 1 }}>
              <span className="icon-bubble" aria-hidden>
                {c.icon}
              </span>
              <div className="grow">
                <div>{c.name}</div>
                <div className="tiny">
                  {c.custom ? 'Personnalisée' : 'Par défaut'}
                  {used.has(c.id) ? ' · utilisée' : ''}
                </div>
              </div>
              <Switch label={c.archived ? 'Masquée' : 'Visible'} checked={!c.archived} onChange={(v) => dispatch({ type: 'category/update', category: { ...c, archived: !v } })} />
            </div>
          ))}
        </div>
      </section>
      <p className="tiny">Masquer une catégorie la retire des choix de saisie sans toucher à l’historique.</p>
    </div>
  );
}
