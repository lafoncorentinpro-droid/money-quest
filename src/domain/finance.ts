import { addDays, daysBetween, inRange, periodOf, periodRange, shiftPeriod } from './dates';
import { sum } from './money';
import { pendingOccurrences } from './recurring';
import type { AppData, Cents, DateRange, Expense, ID, ISODate, PeriodKey, SavingsMovement } from './types';

/**
 * TOUS les calculs financiers de l'application sont ici (et testés dans tests/finance.test.ts).
 * Les composants d'interface n'ont pas le droit de recalculer eux-mêmes.
 */

/** Montant net d'une dépense après remboursements rattachés (jamais négatif). */
export function netExpense(e: Expense): Cents {
  return Math.max(0, e.amount - sum(e.refunds.map((r) => r.amount)));
}

export function refundedAmount(e: Expense): Cents {
  return Math.min(e.amount, sum(e.refunds.map((r) => r.amount)));
}

export function isFullyRefunded(e: Expense): boolean {
  return e.refunds.length > 0 && netExpense(e) === 0;
}

/** 1. Revenus reçus : revenus confirmés sur la période. */
export function incomesReceived(data: Pick<AppData, 'incomes'>, r: DateRange): Cents {
  return sum(data.incomes.filter((i) => i.status === 'recu' && inRange(i.date, r)).map((i) => i.amount));
}

/** 2. Dépenses réalisées : dépenses confirmées, nettes des remboursements associés. */
export function expensesRealized(data: Pick<AppData, 'expenses'>, r: DateRange, filter?: (e: Expense) => boolean): Cents {
  return sum(data.expenses.filter((e) => e.status === 'realisee' && inRange(e.date, r) && (!filter || filter(e))).map(netExpense));
}

export function expensesByCategory(data: Pick<AppData, 'expenses'>, r: DateRange): Record<ID, Cents> {
  const out: Record<ID, Cents> = {};
  for (const e of data.expenses) {
    if (e.status !== 'realisee' || !inRange(e.date, r)) continue;
    out[e.categoryId] = (out[e.categoryId] ?? 0) + netExpense(e);
  }
  return out;
}

/** 3. Épargne transférée : versements et retraits réels. Les transferts entre objectifs sont neutres. */
export function savingsFlows(movements: SavingsMovement[], r: DateRange): { deposits: Cents; withdrawals: Cents; net: number } {
  let deposits = 0;
  let withdrawals = 0;
  for (const m of movements) {
    if (!inRange(m.date, r)) continue;
    if (m.type === 'versement') deposits += m.amount;
    else if (m.type === 'retrait') withdrawals += m.amount;
  }
  return { deposits, withdrawals, net: deposits - withdrawals };
}

/** Solde d'un objectif (jusqu'à une date incluse si fournie). */
export function goalBalance(goalId: ID, movements: SavingsMovement[], upTo?: ISODate): Cents {
  let bal = 0;
  for (const m of movements) {
    if (upTo && m.date > upTo) continue;
    if (m.goalId === goalId) {
      if (m.type === 'versement') bal += m.amount;
      else bal -= m.amount; // retrait ou transfert sortant
    } else if (m.type === 'transfert' && m.toGoalId === goalId) {
      bal += m.amount;
    }
  }
  return bal;
}

/** 4. Épargne totale : somme des soldes des enveloppes. */
export function totalSavings(data: Pick<AppData, 'goals' | 'movements'>, upTo?: ISODate): Cents {
  return sum(data.goals.map((g) => goalBalance(g.id, data.movements, upTo)));
}

export type CategoryState = 'ok' | 'proche' | 'depasse';

export function categoryState(spent: Cents, limit: Cents): CategoryState {
  if (limit <= 0) return spent > 0 ? 'depasse' : 'ok';
  if (spent > limit) return 'depasse';
  if (spent * 100 >= limit * 80) return 'proche';
  return 'ok';
}

export interface CategoryLine {
  categoryId: ID;
  limit: Cents;
  spent: Cents;
  /** 5. Reste du budget de la catégorie (négatif si dépassé). */
  remaining: number;
  state: CategoryState;
}

export interface MonthSummary {
  period: PeriodKey;
  range: DateRange;
  carryIn: number;
  openingBalance: number;
  incomesReceived: Cents;
  incomesPlanned: Cents; // encore attendus (récurrences non confirmées + revenus "prévu")
  expensesRealized: Cents;
  expensesPlanned: Cents; // encore à payer (récurrences non confirmées + dépenses "prévue")
  fixedRealized: Cents;
  variableRealized: Cents;
  savingsDeposits: Cents;
  savingsWithdrawals: Cents;
  savingsNet: number;
  /** 6. Disponible estimé = report + solde de départ + revenus reçus − dépenses réalisées − épargne nette transférée. */
  available: number;
  /** 7. Prévision de fin de mois (estimation) = disponible + revenus attendus − dépenses prévues. */
  forecast: number;
  savingsTarget: Cents;
  /** Dépenses fixes encore prévues (récurrences non confirmées + dépenses fixes « prévue »). */
  fixedPlanned: Cents;
  /**
   * Reste à vivre estimé = revenus du mois (reçus + attendus) − dépenses fixes (réalisées + prévues)
   * − objectif d'épargne du mois. C'est ce qui reste pour les dépenses variables.
   */
  resteAVivre: number;
  categories: CategoryLine[];
  budgetTotal: Cents;
  budgetSpent: Cents;
  hasBudget: boolean;
}

export function monthSummary(data: AppData, period: PeriodKey): MonthSummary {
  const startDay = data.settings.monthStartDay;
  const range = periodRange(period, startDay);
  const budget = data.budgets[period];

  const received = incomesReceived(data, range);
  const realized = expensesRealized(data, range);
  const fixedRealized = expensesRealized(data, range, (e) => e.nature === 'fixe');
  const flows = savingsFlows(data.movements, range);

  const pending = pendingOccurrences(data, range);
  const incomesPlanned =
    sum(pending.filter((p) => p.rec.kind === 'income').map((p) => p.rec.amount)) +
    sum(data.incomes.filter((i) => i.status === 'prevu' && inRange(i.date, range)).map((i) => i.amount));
  const expensesPlanned =
    sum(pending.filter((p) => p.rec.kind === 'expense').map((p) => p.rec.amount)) +
    sum(data.expenses.filter((e) => e.status === 'prevue' && inRange(e.date, range)).map((e) => e.amount));

  const fixedPlanned =
    sum(pending.filter((p) => p.rec.kind === 'expense' && p.rec.nature === 'fixe').map((p) => p.rec.amount)) +
    sum(data.expenses.filter((e) => e.status === 'prevue' && e.nature === 'fixe' && inRange(e.date, range)).map((e) => e.amount));
  const savingsTarget = budget?.savingsTarget ?? 0;

  const carryIn = budget?.carryOver?.amount ?? 0;
  const ob = data.settings.openingBalance;
  const openingBalance = ob && ob.period === period ? ob.amount : 0;

  const available = carryIn + openingBalance + received - realized - flows.net;

  const byCat = expensesByCategory(data, range);
  const categories: CategoryLine[] = (budget?.categories ?? []).map((bc) => {
    const spent = byCat[bc.categoryId] ?? 0;
    return { categoryId: bc.categoryId, limit: bc.limit, spent, remaining: bc.limit - spent, state: categoryState(spent, bc.limit) };
  });
  const budgetTotal = sum(categories.map((c) => c.limit));
  const budgetSpent = sum(categories.map((c) => c.spent));

  return {
    period,
    range,
    carryIn,
    openingBalance,
    incomesReceived: received,
    incomesPlanned,
    expensesRealized: realized,
    expensesPlanned,
    fixedRealized,
    variableRealized: realized - fixedRealized,
    savingsDeposits: flows.deposits,
    savingsWithdrawals: flows.withdrawals,
    savingsNet: flows.net,
    available,
    forecast: available + incomesPlanned - expensesPlanned,
    savingsTarget,
    fixedPlanned,
    resteAVivre: received + incomesPlanned - fixedRealized - fixedPlanned - savingsTarget,
    categories,
    budgetTotal,
    budgetSpent,
    hasBudget: !!budget
  };
}

/** Montant proposé pour un report au mois suivant : le disponible estimé du mois précédent. */
export function suggestedCarryOver(data: AppData, period: PeriodKey): number {
  return monthSummary(data, shiftPeriod(period, -1)).available;
}

export function currentPeriod(data: AppData, today: ISODate): PeriodKey {
  return periodOf(today, data.settings.monthStartDay);
}

/** Moyenne quotidienne de dépenses sur une plage (jours écoulés seulement si la plage contient aujourd'hui). */
export function dailyAverage(total: Cents, r: DateRange, today: ISODate): Cents {
  const end = today < r.end && today >= r.start ? today : r.end;
  const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(r.start)) / 86400000) + 1);
  return Math.round(total / days);
}

/* ----- Gestion mensuelle : revenus → dépenses → épargne ----- */

export interface MonthFlow {
  period: PeriodKey;
  range: DateRange;
  /** Revenus attendus sur le mois : reçus + prévus (dont récurrences non confirmées). Hors annulés. */
  incomesExpected: Cents;
  incomesReceived: Cents;
  /** Dépenses du mois hors annulées : payées + prévues (dont récurrences non confirmées). */
  expensesExpected: Cents;
  expensesPaid: Cents;
  expensesPlanned: Cents;
  savingsDeposits: Cents;
  savingsWithdrawals: Cents;
  /** Épargne réalisée = versements − retraits du mois. */
  savingsNet: number;
  /**
   * Reste disponible = revenus réellement reçus − dépenses réellement payées
   * − sommes transférées vers l'épargne + retraits d'épargne.
   */
  resteDisponible: number;
  /** Report et solde de départ éventuels (explicites), ajoutés à part. */
  extras: number;
  savingsTarget: Cents;
  /** Taux d'épargne en % (épargne réalisée / revenus reçus), null sans revenu reçu. */
  savingsRate: number | null;
  stage: 'revenus' | 'depenses' | 'epargne' | 'complet';
}

export function monthFlow(data: AppData, period: PeriodKey): MonthFlow {
  const s = monthSummary(data, period);
  const r = s.range;
  const incomesExpected =
    sum(data.incomes.filter((i) => i.status !== 'annule' && inRange(i.date, r)).map((i) => i.amount)) +
    sum(pendingOccurrences(data, r).filter((p) => p.rec.kind === 'income').map((p) => p.rec.amount));
  const resteDisponible = s.incomesReceived - s.expensesRealized - s.savingsDeposits + s.savingsWithdrawals;
  const hasIncome = data.incomes.some((i) => i.status !== 'annule' && inRange(i.date, r)) || incomesExpected > 0;
  const hasExpense = data.expenses.some((e) => e.status !== 'annulee' && inRange(e.date, r));
  const hasSaving = data.movements.some((m) => inRange(m.date, r));
  return {
    period,
    range: r,
    incomesExpected,
    incomesReceived: s.incomesReceived,
    expensesExpected: s.expensesRealized + s.expensesPlanned,
    expensesPaid: s.expensesRealized,
    expensesPlanned: s.expensesPlanned,
    savingsDeposits: s.savingsDeposits,
    savingsWithdrawals: s.savingsWithdrawals,
    savingsNet: s.savingsNet,
    resteDisponible,
    extras: s.carryIn + s.openingBalance,
    savingsTarget: s.savingsTarget,
    savingsRate: s.incomesReceived > 0 ? Math.round((s.savingsNet / s.incomesReceived) * 1000) / 10 : null,
    stage: !hasIncome ? 'revenus' : !hasExpense ? 'depenses' : !hasSaving ? 'epargne' : 'complet'
  };
}

export interface IncomeUsage {
  /** null = dépenses générales du mois (non rattachées). */
  incomeId: ID | null;
  amount: Cents; // montant du revenu (0 pour « général »)
  paid: Cents; // dépenses payées rattachées (nettes des remboursements)
  planned: Cents; // dépenses prévues rattachées
  remaining: number; // revenu − payé (indicatif)
}

/**
 * Utilisation de chaque revenu du mois. Chaque dépense est comptée UNE seule fois :
 * soit dans son revenu, soit dans « général ». La somme des `paid` = dépenses payées du mois.
 */
export function incomeUsage(data: AppData, period: PeriodKey): IncomeUsage[] {
  const r = periodRange(period, data.settings.monthStartDay);
  const incomes = data.incomes.filter((i) => i.status !== 'annule' && inRange(i.date, r));
  const ids = new Set(incomes.map((i) => i.id));
  const rows = new Map<ID | null, IncomeUsage>();
  for (const i of incomes) rows.set(i.id, { incomeId: i.id, amount: i.amount, paid: 0, planned: 0, remaining: i.amount });
  rows.set(null, { incomeId: null, amount: 0, paid: 0, planned: 0, remaining: 0 });
  for (const e of data.expenses) {
    if (e.status === 'annulee' || !inRange(e.date, r)) continue;
    const key = e.incomeId && ids.has(e.incomeId) ? e.incomeId : null;
    const row = rows.get(key)!;
    if (e.status === 'realisee') row.paid += netExpense(e);
    else row.planned += e.amount;
  }
  for (const row of rows.values()) row.remaining = row.amount - row.paid;
  return [...rows.values()];
}

/* ----- Statistiques ----- */

export interface PeriodPoint {
  period: PeriodKey;
  incomes: Cents;
  expenses: Cents;
  savingsNet: number;
  savingsTotal: Cents; // épargne totale à la fin de la période
}

export function seriesByPeriod(data: AppData, periods: PeriodKey[]): PeriodPoint[] {
  const startDay = data.settings.monthStartDay;
  return periods.map((p) => {
    const r = periodRange(p, startDay);
    return {
      period: p,
      incomes: incomesReceived(data, r),
      expenses: expensesRealized(data, r),
      savingsNet: savingsFlows(data.movements, r).net,
      savingsTotal: totalSavings(data, r.end)
    };
  });
}

export interface RangeStats {
  incomes: Cents;
  expenses: Cents;
  fixed: Cents;
  variable: Cents;
  savingsNet: number;
  byCategory: { categoryId: ID; amount: Cents }[];
  dailyAverage: Cents;
}

export function rangeStats(data: AppData, r: DateRange, today: ISODate): RangeStats {
  const expenses = expensesRealized(data, r);
  const fixed = expensesRealized(data, r, (e) => e.nature === 'fixe');
  const byCat = expensesByCategory(data, r);
  return {
    incomes: incomesReceived(data, r),
    expenses,
    fixed,
    variable: expenses - fixed,
    savingsNet: savingsFlows(data.movements, r).net,
    byCategory: Object.entries(byCat)
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    dailyAverage: dailyAverage(expenses, r, today)
  };
}

/* ----- Bilan de fin de mois : formulations bienveillantes, sans jugement ----- */

export interface Bilan {
  current: MonthSummary;
  previous: MonthSummary;
  topCategories: { categoryId: ID; amount: Cents }[];
  byCategory: { categoryId: ID; amount: Cents }[];
  flow: MonthFlow;
  previousFlow: MonthFlow;
  expensesDelta: number;
  incomesDelta: number;
  positives: string[];
  ideas: string[];
}

export function buildBilan(data: AppData, period: PeriodKey, fmt: (c: number) => string): Bilan {
  const current = monthSummary(data, period);
  const previous = monthSummary(data, shiftPeriod(period, -1));
  const byCat = expensesByCategory(data, current.range);
  const byCategory = Object.entries(byCat)
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const topCategories = byCategory.slice(0, 3);
  const positives: string[] = [];
  const ideas: string[] = [];
  const name = (id: ID) => data.categories.find((c) => c.id === id)?.name ?? id;

  const count = data.expenses.filter((e) => e.status === 'realisee' && inRange(e.date, current.range)).length + data.incomes.filter((i) => inRange(i.date, current.range)).length;
  if (count > 0) positives.push(`Tu as noté ${count} opération${count > 1 ? 's' : ''} ce mois-ci : c’est la base d’un suivi fiable.`);
  if (current.savingsDeposits > 0) positives.push(`Tu as mis ${fmt(current.savingsDeposits)} de côté.`);
  const okCats = current.categories.filter((c) => c.state !== 'depasse');
  if (current.categories.length && okCats.length === current.categories.length) positives.push('Toutes tes catégories budgétées sont restées dans leurs limites.');
  else if (okCats.length) positives.push(`${okCats.length} catégorie${okCats.length > 1 ? 's sont restées' : ' est restée'} dans sa limite.`);
  if (previous.expensesRealized > 0 && current.expensesRealized < previous.expensesRealized)
    positives.push(`Tes dépenses sont plus basses que le mois précédent (${fmt(previous.expensesRealized - current.expensesRealized)} de moins).`);

  const over = current.categories.filter((c) => c.state === 'depasse');
  for (const c of over.slice(0, 2)) ideas.push(`« ${name(c.categoryId)} » a dépassé de ${fmt(-c.remaining)}. La limite était peut-être serrée : tu peux l’ajuster le mois prochain.`);
  if (!current.hasBudget) ideas.push('Préparer un budget pour le mois prochain t’aidera à voir venir.');
  if (current.expensesPlanned > 0) ideas.push(`Il reste ${fmt(current.expensesPlanned)} d’échéances non confirmées : pense à les vérifier.`);
  if (current.savingsTarget > 0 && current.savingsNet < current.savingsTarget)
    ideas.push(`L’objectif d’épargne du mois n’est pas encore atteint (${fmt(current.savingsNet)} sur ${fmt(current.savingsTarget)}). Un objectif plus doux est aussi une bonne option.`);
  if (!positives.length) positives.push('Ouvrir ton bilan, c’est déjà prendre soin de tes finances.');

  return {
    current,
    previous,
    topCategories,
    byCategory,
    flow: monthFlow(data, period),
    previousFlow: monthFlow(data, shiftPeriod(period, -1)),
    expensesDelta: current.expensesRealized - previous.expensesRealized,
    incomesDelta: current.incomesReceived - previous.incomesReceived,
    positives,
    ideas
  };
}

/* ----- Simulateur (aucune écriture de données) ----- */

/** Nombre de mois pour atteindre une cible avec un versement mensuel. null si impossible. */
export function monthsToReach(current: Cents, target: Cents, monthly: Cents): number | null {
  if (current >= target) return 0;
  if (monthly <= 0) return null;
  return Math.ceil((target - current) / monthly);
}

/** Versement mensuel nécessaire pour atteindre une cible en n mois. */
export function monthlyNeeded(current: Cents, target: Cents, months: number): Cents {
  if (current >= target) return 0;
  if (months <= 0) return target - current;
  return Math.ceil((target - current) / months);
}

/** Projection simple de l'épargne mois par mois (sans intérêts). */
export function projectGoal(current: Cents, monthly: Cents, months: number): Cents[] {
  return Array.from({ length: months + 1 }, (_, i) => current + monthly * i);
}

/* ---------- Accueil : opérations récentes groupées par jour ---------- */

export interface DayItem {
  date: ISODate;
  amount: Cents;
  sign: '+' | '−' | '⇄';
  planned: boolean;
  cancelled: boolean;
}

export interface DayGroup<T extends DayItem> {
  date: ISODate;
  /** Solde net du jour : entrées − sorties réalisées (prévu, annulé et transferts entre objectifs exclus). */
  net: number;
  items: T[];
}

/** Regroupe les opérations réalisées par jour (plus récent d'abord) et garde les `maxDays` derniers jours. */
export function recentByDay<T extends DayItem>(items: T[], maxDays = 3): DayGroup<T>[] {
  const done = items.filter((i) => !i.planned && !i.cancelled);
  const byDate = new Map<ISODate, T[]>();
  for (const i of done) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
  return [...byDate.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, maxDays)
    .map((date) => {
      const day = byDate.get(date)!;
      const net = day.reduce((acc, i) => acc + (i.sign === '+' ? i.amount : i.sign === '−' ? -i.amount : 0), 0);
      return { date, net, items: day };
    });
}

/* ---------- Graphique du mois et bilan de l'année ---------- */

export interface DayPoint {
  date: ISODate;
  available: number; // disponible estimé en fin de journée
}

/** Évolution jour par jour du disponible estimé sur le mois (jusqu'à aujourd'hui pour le mois en cours). */
export function monthCurve(data: AppData, period: PeriodKey, today: ISODate): DayPoint[] {
  const r = periodRange(period, data.settings.monthStartDay);
  const s = monthSummary(data, period);
  const last = today < r.end ? today : r.end;
  if (last < r.start) return [];
  let acc = s.carryIn + s.openingBalance;
  const out: DayPoint[] = [];
  for (let d = r.start; d <= last; d = addDays(d, 1)) {
    const day = { start: d, end: d };
    acc += incomesReceived(data, day) - expensesRealized(data, day) - savingsFlows(data.movements, day).net;
    out.push({ date: d, available: acc });
  }
  return out;
}

/** Où en est-on dans le mois : jour courant / nombre de jours (le mois passé est complet, le futur à 0). */
export function monthProgress(data: AppData, period: PeriodKey, today: ISODate): { day: number; days: number } {
  const r = periodRange(period, data.settings.monthStartDay);
  const days = daysBetween(r.start, r.end) + 1;
  if (today < r.start) return { day: 0, days };
  if (today > r.end) return { day: days, days };
  return { day: daysBetween(r.start, today) + 1, days };
}

export interface YearSummary {
  year: number;
  months: PeriodPoint[];
  incomes: Cents;
  expenses: Cents;
  /** Mis en épargne (versements − retraits). */
  savingsNet: number;
  /** Économisé = revenus reçus − dépenses réalisées. */
  saved: number;
}

export function yearSummary(data: AppData, year: number): YearSummary {
  const months = seriesByPeriod(
    data,
    Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}` as PeriodKey)
  );
  const incomes = sum(months.map((m) => m.incomes));
  const expenses = sum(months.map((m) => m.expenses));
  return { year, months, incomes, expenses, savingsNet: months.reduce((a, m) => a + m.savingsNet, 0), saved: incomes - expenses };
}
