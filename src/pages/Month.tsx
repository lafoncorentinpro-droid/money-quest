import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateShort, inRange, parsePeriod, periodLabel, shiftPeriod } from '../domain/dates';
import { INCOME_TYPE_LABEL } from '../domain/defaults';
import { goalBalance, incomeUsage, monthFlow } from '../domain/finance';
import { centsToInput, parseAmount, percent } from '../domain/money';
import { pendingOccurrences } from '../domain/recurring';
import type { PeriodKey } from '../domain/types';
import { useStore } from '../store/store';
import { Empty, Progress } from '../ui/components';
import { Fox } from '../ui/Fox';
import { Icon } from '../ui/Icon';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';
import { buildRows, OpRowView } from './operations';

const SHORT = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];

/* ======================= Sélecteur de mois ======================= */

export function MonthStrip() {
  const { data, month, setMonth, period: current } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const months = useMemo(() => Array.from({ length: 25 }, (_, i) => shiftPeriod(month, i - 12)), [month]);
  useEffect(() => {
    ref.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [month]);
  const status = (p: PeriodKey) => {
    if (p === current) return 'En cours';
    const f = monthFlow(data, p);
    if (p < current) return f.stage === 'revenus' ? 'À consulter' : 'Terminé';
    return f.stage === 'revenus' ? 'À préparer' : 'Préparé';
  };
  const { y } = parsePeriod(month);
  return (
    <section className="stack" style={{ gap: 8 }} aria-label="Choisir le mois">
      <div className="row-between">
        <span className="tiny" style={{ fontWeight: 700, letterSpacing: '0.08em' }}>
          {y}
        </span>
        {month !== current && (
          <button type="button" className="link" onClick={() => setMonth(current)}>
            Revenir au mois en cours
          </button>
        )}
      </div>
      <div className="month-strip" ref={ref}>
        {months.map((p) => {
          const { y: py, m } = parsePeriod(p);
          return (
            <button key={p} type="button" className={`month-chip ${p === current ? 'is-current' : ''}`} aria-pressed={p === month} onClick={() => setMonth(p)}>
              <strong>{SHORT[m - 1]}</strong>
              <span>{py}</span>
              <small>{status(p)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ======================= Étapes ======================= */

export function StepNav({ active }: { active: string }) {
  const { data, month } = useStore();
  const f = monthFlow(data, month);
  const steps: [string, string, boolean][] = [
    ['revenus', '1 · Revenus', f.stage !== 'revenus'],
    ['depenses', '2 · Dépenses', f.stage === 'epargne' || f.stage === 'complet'],
    ['epargne', '3 · Épargne', f.stage === 'complet'],
    ['bilan', 'Bilan', false]
  ];
  return (
    <nav className="segmented" aria-label="Étapes du mois">
      <button type="button" aria-pressed={active === ''} onClick={() => go('argent')}>
        Mon mois
      </button>
      {steps.map(([k, l, done]) => (
        <button key={k} type="button" aria-pressed={active === k} onClick={() => go(`argent/${k}`)}>
          {done ? '✓ ' : ''}
          {l}
        </button>
      ))}
    </nav>
  );
}

function MonthTotals() {
  const { data, month, money } = useStore();
  const f = monthFlow(data, month);
  return (
    <div className="grid-3">
      <div className="stat">
        <div className="label">Revenus</div>
        <div className="value num pos">{money(f.incomesReceived)}</div>
      </div>
      <div className="stat">
        <div className="label">Dépenses</div>
        <div className="value num">{money(f.expensesPaid)}</div>
      </div>
      <div className="stat">
        <div className="label">Épargne</div>
        <div className="value num">{money(f.savingsNet)}</div>
      </div>
    </div>
  );
}

/* ======================= Mon mois ======================= */

export function MonthOverview() {
  const { data, month, money, period: current } = useStore();
  const open = useSheets();
  const sd = data.settings.monthStartDay;
  const f = monthFlow(data, month);
  const label = periodLabel(month, sd);
  const fox =
    f.stage === 'revenus'
      ? { mood: 'accueil' as const, text: `Une nouvelle aventure commence ! Ouvrons le journal de ${label} avec tes revenus.` }
      : f.stage === 'depenses'
        ? { mood: 'concentre' as const, text: 'Les ressources du mois sont notées. Suivons maintenant les pièces utilisées.' }
        : f.stage === 'epargne'
          ? { mood: 'exploration' as const, text: 'Il reste à remplir le coffre aux trésors, à ton rythme, même un petit peu.' }
          : { mood: 'fier' as const, text: 'Les trois étapes du mois sont en route. Le bilan t’attend quand tu veux.' };

  const cards = [
    {
      k: 'revenus',
      n: 1,
      title: 'Revenus',
      icon: 'arrow-down-circle' as const,
      value: money(f.incomesReceived),
      sub: f.incomesExpected > f.incomesReceived ? `${money(f.incomesExpected - f.incomesReceived)} encore attendus` : data.incomes.length ? 'Ressources du mois' : 'À enregistrer en premier',
      action: () => open({ kind: 'income' }),
      actionLabel: '+ Revenu'
    },
    {
      k: 'depenses',
      n: 2,
      title: 'Dépenses',
      icon: 'card' as const,
      value: money(f.expensesPaid),
      sub: f.expensesPlanned > 0 ? `+ ${money(f.expensesPlanned)} prévues` : 'Dépenses payées',
      action: () => open({ kind: 'expense' }),
      actionLabel: '+ Dépense'
    },
    {
      k: 'epargne',
      n: 3,
      title: 'Épargne',
      icon: 'chest' as const,
      value: money(f.savingsNet),
      sub: f.savingsTarget ? `${percent(f.savingsNet, f.savingsTarget)} % de l’objectif (${money(f.savingsTarget)})` : 'Mise de côté du mois',
      action: () => open({ kind: 'movement' }),
      actionLabel: '+ Versement'
    }
  ];

  return (
    <>
      <MonthStrip />
      <section className="card card-accent stack">
        <div>
          <h2 style={{ textTransform: 'capitalize' }}>{label}</h2>
          <div className="small muted">Ton aventure financière du mois{month === current ? '' : month < current ? ' · mois passé' : ' · mois à venir'}</div>
        </div>
        <div className="fox-bubble">
          <Fox mood={fox.mood} size={64} equipped={data.progress.equipped} animate={data.settings.animations} />
          <div className="speech">{fox.text}</div>
        </div>
        <div className="row-between">
          <span className="muted small">Reste disponible</span>
          <strong className={`num ${f.resteDisponible < 0 ? 'neg' : ''}`} style={{ fontSize: 'var(--fs-title1)', fontFamily: 'var(--font-title)' }}>
            {money(f.resteDisponible)}
          </strong>
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          Revenus reçus − dépenses payées − épargne versée + retraits d’épargne.
          {f.extras !== 0 && ` Avec le report / solde de départ : ${money(f.resteDisponible + f.extras)}.`}
        </p>
      </section>

      <MonthTotals />

      <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Parcours du mois">
        {cards.map((c) => {
          const isNext = f.stage === c.k;
          return (
            <li key={c.k} className={`card step-card ${isNext ? 'is-next' : ''}`}>
              <button type="button" className="step-main" onClick={() => go(`argent/${c.k}`)}>
                <span className="step-num" aria-hidden>
                  {c.n}
                </span>
                <span className="icon-bubble" aria-hidden>
                  <Icon name={c.icon} size={22} />
                </span>
                <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <span className="row-between">
                    <strong>{c.title}</strong>
                    <span className="num" style={{ fontWeight: 650 }}>
                      {c.value}
                    </span>
                  </span>
                  <span className="tiny" style={{ display: 'block' }}>
                    {isNext ? '👉 Prochaine étape · ' : ''}
                    {c.sub}
                  </span>
                </span>
                <Icon name="chevron-right" size={18} className="muted" />
              </button>
              {isNext && (
                <button type="button" className="btn btn-primary btn-block" onClick={c.action} style={{ marginTop: 10 }}>
                  {c.actionLabel}
                </button>
              )}
            </li>
          );
        })}
        <li className="card step-card">
          <button type="button" className="step-main" onClick={() => go('argent/bilan')}>
            <span className="step-num" aria-hidden>
              ★
            </span>
            <span className="icon-bubble" aria-hidden>
              📜
            </span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <strong>Bilan du mois</strong>
              <span className="tiny" style={{ display: 'block' }}>
                Synthèse, taux d’épargne{f.savingsRate !== null ? ` : ${f.savingsRate.toLocaleString('fr-FR')} %` : ''}, comparaison
              </span>
            </span>
            <Icon name="chevron-right" size={18} className="muted" />
          </button>
        </li>
      </ol>

      <section className="card" aria-labelledby="tools">
        <div className="card-head">
          <h2 id="tools">Outils</h2>
        </div>
        <div className="tool-grid">
          {[
            ['operations', '📋', 'Toutes les opérations'],
            ['budget', '🎯', 'Budget par catégorie'],
            ['recurrences', '🔁', 'Récurrences'],
            ['calendrier', '📅', 'Calendrier'],
            ['stats', '📊', 'Statistiques'],
            ['simulateur', '🔮', 'Simulateur']
          ].map(([k, i, l]) => (
            <button key={k} type="button" className="btn" onClick={() => go(`argent/${k}`)}>
              <span aria-hidden>{i}</span> {l}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

/* ======================= Étape 1 : Revenus ======================= */

export function IncomesStep() {
  const { data, month, money, dispatch, toast } = useStore();
  const open = useSheets();
  const r = useMonthRange();
  const incomes = data.incomes.filter((i) => inRange(i.date, r)).sort((a, b) => a.date.localeCompare(b.date));
  const pending = pendingOccurrences(data, r).filter((p) => p.rec.kind === 'income');
  const f = monthFlow(data, month);

  return (
    <>
      <MonthStrip />
      <StepNav active="revenus" />
      <section className="card stack">
        <div className="row-between">
          <h2>Mes revenus — {shortLabel(month)}</h2>
        </div>
        {incomes.length === 0 && pending.length === 0 ? (
          <div className="stack center">
            <Fox mood="accueil" size={80} equipped={data.progress.equipped} animate={data.settings.animations} />
            <p className="muted" style={{ margin: 0 }}>
              Ce mois n’a pas encore de revenus. Commence par là : salaire, prime, aide, activité secondaire… Tu peux en ajouter plusieurs.
            </p>
          </div>
        ) : (
          <div className="list">
            {incomes.map((i) => (
              <div key={i.id} className={`list-row ${i.status === 'prevu' ? 'planned-row' : ''}`}>
                <button type="button" className="grow row" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', minWidth: 0 }} onClick={() => open({ kind: 'income', id: i.id })}>
                  <span className="icon-bubble" aria-hidden>
                    <Icon name="arrow-down-circle" />
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="ellipsis" style={{ display: 'block', textDecoration: i.status === 'annule' ? 'line-through' : undefined }}>
                      {i.description || INCOME_TYPE_LABEL[i.type]}
                    </span>
                    <span className="tiny">
                      {INCOME_TYPE_LABEL[i.type]} · {formatDateShort(i.date)}
                    </span>
                  </span>
                </button>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <span className="num pos" style={{ fontWeight: 650 }}>
                    {money(i.amount)}
                  </span>
                  {i.status === 'prevu' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-soft"
                      onClick={() => {
                        dispatch({ type: 'income/update', income: { ...i, status: 'recu' } });
                        toast('Revenu marqué comme reçu', 'success');
                      }}
                    >
                      Marquer reçu
                    </button>
                  ) : (
                    <span className={`tag ${i.status === 'annule' ? '' : 'tag-ok'}`}>{i.status === 'annule' ? 'Annulé' : '✓ Reçu'}</span>
                  )}
                </div>
              </div>
            ))}
            {pending.map((p) => (
              <div key={p.rec.id + p.date} className="list-row planned-row">
                <span className="icon-bubble" aria-hidden>
                  <Icon name="repeat" />
                </span>
                <div className="grow">
                  <div className="ellipsis">{p.rec.description}</div>
                  <div className="tiny">Récurrent · prévu le {formatDateShort(p.date)}</div>
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <span className="num">{money(p.rec.amount)}</span>
                  <button type="button" className="btn btn-sm btn-soft" onClick={() => open({ kind: 'occurrence', rec: p.rec, date: p.date })}>
                    Reçu ?
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid-2">
          <div className="stat">
            <div className="label">Total prévu</div>
            <div className="value num">{money(f.incomesExpected)}</div>
          </div>
          <div className="stat">
            <div className="label">Total reçu</div>
            <div className="value num pos">{money(f.incomesReceived)}</div>
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => open({ kind: 'income' })}>
          <Icon name="plus" size={20} /> Ajouter un revenu
        </button>
        <button type="button" className="btn btn-block" onClick={() => open({ kind: 'recurring', recKind: 'income' })}>
          <Icon name="repeat" size={20} /> Revenu qui revient chaque mois
        </button>
        <p className="tiny" style={{ margin: 0 }}>
          Un revenu n’est jamais recopié dans un autre mois, sauf si tu crées un revenu récurrent.
        </p>
      </section>
      {(incomes.length > 0 || pending.length > 0) && (
        <button type="button" className="btn btn-soft btn-block" onClick={() => go('argent/depenses')}>
          Étape suivante : les dépenses <Icon name="chevron-right" size={18} />
        </button>
      )}
    </>
  );
}

/* ======================= Étape 2 : Dépenses ======================= */

type ExpFilter = 'toutes' | 'payees' | 'prevues' | 'fixes' | 'variables';

export function ExpensesStep() {
  const { data, month, money } = useStore();
  const open = useSheets();
  const r = useMonthRange();
  const [incomeSel, setIncomeSel] = useState<string>('all'); // 'all' | 'general' | incomeId
  const [filter, setFilter] = useState<ExpFilter>('toutes');
  const [cat, setCat] = useState('');
  const usage = incomeUsage(data, month);
  const incomes = data.incomes.filter((i) => i.status !== 'annule' && inRange(i.date, r));
  const f = monthFlow(data, month);
  const general = usage.find((u) => u.incomeId === null)!;
  useEffect(() => setIncomeSel('all'), [month]);

  const rows = buildRows(data, r).filter((x) => {
    if (!(x.kind === 'expense' || (x.kind === 'occurrence' && x.sign === '−'))) return false;
    const e = x.kind === 'expense' ? data.expenses.find((d) => d.id === x.key) : undefined;
    if (incomeSel === 'general' && (x.kind !== 'expense' || (e?.incomeId && incomes.some((i) => i.id === e.incomeId)))) return false;
    if (incomeSel !== 'all' && incomeSel !== 'general' && e?.incomeId !== incomeSel) return false;
    if (filter === 'payees' && (x.planned || x.cancelled)) return false;
    if (filter === 'prevues' && !x.planned) return false;
    if (filter === 'fixes' && x.nature !== 'fixe') return false;
    if (filter === 'variables' && x.nature !== 'variable') return false;
    if (cat && x.categoryId !== cat) return false;
    return true;
  });
  rows.sort((a, b) => b.date.localeCompare(a.date));

  const presetIncome = incomeSel !== 'all' && incomeSel !== 'general' ? incomeSel : undefined;

  return (
    <>
      <MonthStrip />
      <StepNav active="depenses" />
      <section className="card stack" aria-labelledby="rev">
        <div className="row-between">
          <h2 id="rev" className="small muted" style={{ fontFamily: 'var(--font)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Mes revenus pour ce mois
          </h2>
          <strong className="num">{money(f.incomesExpected)}</strong>
        </div>
        {incomes.length === 0 ? (
          <div className="notice notice-gold small">
            <span aria-hidden>💡</span>
            <span>
              Aucun revenu pour {shortLabel(month)}.{' '}
              <button type="button" className="link" onClick={() => go('argent/revenus')}>
                Commencer par les revenus
              </button>{' '}
              (tu peux quand même noter des dépenses).
            </span>
          </div>
        ) : (
          <p className="tiny" style={{ margin: 0 }}>
            {incomes.map((i) => `${i.description || INCOME_TYPE_LABEL[i.type]} : ${money(i.amount)}${i.status === 'prevu' ? ' (prévu)' : ''}`).join(' · ')}
          </p>
        )}
        <div className="income-pick" role="group" aria-label="Filtrer par revenu">
          <button type="button" className="income-card" aria-pressed={incomeSel === 'all'} onClick={() => setIncomeSel('all')}>
            <strong>Toutes</strong>
            <span className="num">{money(f.expensesPaid)}</span>
            <small>payées ce mois</small>
          </button>
          {incomes.map((i) => {
            const u = usage.find((x) => x.incomeId === i.id)!;
            return (
              <button key={i.id} type="button" className="income-card" aria-pressed={incomeSel === i.id} onClick={() => setIncomeSel(i.id)}>
                <strong className="ellipsis">{i.description || INCOME_TYPE_LABEL[i.type]}</strong>
                <span className="num">{money(i.amount)}</span>
                <small className="num">
                  {money(u.paid)} utilisés · reste {money(u.remaining)}
                </small>
                <Progress value={u.paid} max={i.amount} tone={u.paid > i.amount ? 'depasse' : 'ok'} label={`Utilisation de ${i.description}`} />
              </button>
            );
          })}
          <button type="button" className="income-card" aria-pressed={incomeSel === 'general'} onClick={() => setIncomeSel('general')}>
            <strong>Dépenses générales</strong>
            <span className="num">{money(general.paid)}</span>
            <small>non rattachées à un revenu</small>
          </button>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => open({ kind: 'expense', preset: { incomeId: presetIncome } })}>
          <Icon name="plus" size={20} />
          {presetIncome ? ` Dépense sur « ${incomes.find((i) => i.id === presetIncome)?.description || 'ce revenu'} »` : ' Ajouter une dépense'}
        </button>
      </section>

      <div className="grid-2">
        <div className="stat">
          <div className="label">Payées</div>
          <div className="value num">{money(f.expensesPaid)}</div>
        </div>
        <div className="stat">
          <div className="label">Prévues</div>
          <div className="value num">{money(f.expensesPlanned)}</div>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filtrer les dépenses">
        {(
          [
            ['toutes', 'Toutes'],
            ['payees', 'Payées'],
            ['prevues', 'Prévues'],
            ['fixes', 'Fixes'],
            ['variables', 'Variables']
          ] as [ExpFilter, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>
      <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
        <option value="">Toutes les catégories</option>
        {data.categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </select>

      <section className="card" aria-label="Dépenses du mois">
        {rows.length === 0 ? (
          <Empty icon="🪙" title="Aucune dépense ici">
            <span className="small">Ajoute ta première dépense du mois : loyer, courses, transport…</span>
          </Empty>
        ) : (
          <div className="list">
            {rows.map((row) => (
              <OpRowView key={row.key} row={row} money={money} onOpen={open} showDate />
            ))}
          </div>
        )}
      </section>
      <button type="button" className="btn btn-soft btn-block" onClick={() => go('argent/epargne')}>
        Étape suivante : l’épargne <Icon name="chevron-right" size={18} />
      </button>
    </>
  );
}

/* ======================= Étape 3 : Épargne ======================= */

export function SavingsStep() {
  const { data, month, money, dispatch, toast } = useStore();
  const open = useSheets();
  const r = useMonthRange();
  const f = monthFlow(data, month);
  const budget = data.budgets[month];
  const [target, setTarget] = useState(f.savingsTarget ? centsToInput(f.savingsTarget) : '');
  useEffect(() => setTarget(f.savingsTarget ? centsToInput(f.savingsTarget) : ''), [month, f.savingsTarget]);
  const movements = data.movements.filter((m) => inRange(m.date, r)).sort((a, b) => b.date.localeCompare(a.date));
  const goalName = (id?: string) => data.goals.find((g) => g.id === id);
  const left = Math.max(0, f.savingsTarget - f.savingsNet);

  const saveTarget = () => {
    const c = target.trim() ? parseAmount(target) : 0;
    if (c === null) {
      toast('Montant invalide', 'error');
      return;
    }
    dispatch({ type: 'budget/save', budget: { period: month, categories: budget?.categories ?? [], savingsTarget: c } });
    toast('Objectif du mois enregistré', 'success');
  };

  return (
    <>
      <MonthStrip />
      <StepNav active="epargne" />
      <section className="card card-accent stack" aria-labelledby="sav">
        <div className="row-between">
          <h2 id="sav">Mon épargne — {shortLabel(month)}</h2>
          <Fox mood={f.savingsTarget && f.savingsNet >= f.savingsTarget ? 'celebration' : 'exploration'} size={48} equipped={data.progress.equipped} animate={data.settings.animations} />
        </div>
        {f.savingsTarget > 0 ? (
          <>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span className="hero-amount num">{money(f.savingsNet)}</span>
              <span className="muted">/ {money(f.savingsTarget)}</span>
            </div>
            <Progress value={f.savingsNet} max={f.savingsTarget} tone={f.savingsNet >= f.savingsTarget ? 'ok' : 'xp'} label="Progression de l’objectif du mois" />
            <div className="row-between small">
              <span>
                <strong>{percent(f.savingsNet, f.savingsTarget)} %</strong> atteint
              </span>
              <span className="muted num">{left > 0 ? `${money(left)} restants` : 'Objectif atteint 🎉'}</span>
            </div>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Pas encore d’objectif ce mois-ci. Choisis un montant réaliste : même petit, il compte.
          </p>
        )}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow">
            <span>Objectif du mois</span>
            <input className="input" inputMode="decimal" placeholder="0,00 €" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <button type="button" className="btn" onClick={saveTarget}>
            OK
          </button>
        </div>
      </section>

      <section className="card stack" aria-label="Tableau du mois">
        <div className="calc-lines">
          <div className="row-between">
            <span>Revenus reçus</span>
            <span className="num">{money(f.incomesReceived)}</span>
          </div>
          <div className="row-between">
            <span>− Dépenses payées</span>
            <span className="num">{money(f.expensesPaid)}</span>
          </div>
          <div className="row-between">
            <span>− Versements d’épargne</span>
            <span className="num">{money(f.savingsDeposits)}</span>
          </div>
          <div className="row-between">
            <span>+ Retraits d’épargne</span>
            <span className="num">{money(f.savingsWithdrawals)}</span>
          </div>
          <div className="row-between total">
            <strong>Reste disponible</strong>
            <strong className={`num ${f.resteDisponible < 0 ? 'neg' : ''}`}>{money(f.resteDisponible)}</strong>
          </div>
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          Mettre de côté n’est pas une dépense : c’est un transfert de ton argent disponible vers ton coffre.
        </p>
      </section>

      <div className="grid-2">
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'movement', type: 'versement' })}>
          <Icon name="chest" size={20} /> Mettre de côté
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'movement', type: 'retrait' })} disabled={!data.goals.length}>
          Retirer
        </button>
      </div>

      <section className="card" aria-label="Mouvements du mois">
        <div className="card-head">
          <h2>Mouvements du mois</h2>
          <button type="button" className="link" onClick={() => go('tresors')}>
            Mes objectifs
          </button>
        </div>
        {movements.length === 0 ? (
          <p className="small muted">Aucun mouvement ce mois-ci.</p>
        ) : (
          <div className="list">
            {movements.map((m) => {
              const g = goalName(m.goalId);
              const inward = m.type === 'versement';
              return (
                <button key={m.id} type="button" className="list-row" onClick={() => go(`tresors/${m.goalId}`)}>
                  <span className="icon-bubble" aria-hidden>
                    {g?.icon ?? '🪙'}
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="ellipsis" style={{ display: 'block' }}>
                      {m.type === 'transfert' ? `${g?.name} → ${goalName(m.toGoalId)?.name}` : `${inward ? 'Versement' : 'Retrait'} · ${g?.name}`}
                    </span>
                    <span className="tiny">{formatDateShort(m.date)}</span>
                  </span>
                  <span className={`num ${inward ? 'pos' : ''}`}>
                    {m.type === 'transfert' ? '⇄ ' : inward ? '+' : '−'}
                    {money(m.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {data.goals.length > 0 && (
        <section className="card stack" aria-label="Progression des objectifs">
          <h2>Mes trésors</h2>
          {data.goals.map((g) => {
            const b = goalBalance(g.id, data.movements);
            return (
              <div key={g.id} className="stack" style={{ gap: 4 }}>
                <div className="row-between small">
                  <span>
                    {g.icon} {g.name}
                  </span>
                  <span className="num">{g.target > 0 ? `${money(b)} / ${money(g.target)}` : money(b)}</span>
                </div>
                {g.target > 0 && <Progress value={b} max={g.target} tone={b >= g.target ? 'ok' : undefined} label={g.name} />}
              </div>
            );
          })}
        </section>
      )}
      <button type="button" className="btn btn-soft btn-block" onClick={() => go('argent/bilan')}>
        Voir le bilan du mois <Icon name="chevron-right" size={18} />
      </button>
    </>
  );
}

/* ======================= Utilitaires ======================= */

function useMonthRange() {
  const { data, month } = useStore();
  return monthFlow(data, month).range;
}

function shortLabel(p: PeriodKey) {
  const { y, m } = parsePeriod(p);
  const names = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${names[m - 1]} ${y}`;
}

