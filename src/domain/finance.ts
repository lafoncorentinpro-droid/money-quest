import { inRange, periodOf, periodRange, shiftPeriod } from './dates';
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
  expensesDelta: number;
  incomesDelta: number;
  positives: string[];
  ideas: string[];
}

export function buildBilan(data: AppData, period: PeriodKey, fmt: (c: number) => string): Bilan {
  const current = monthSummary(data, period);
  const previous = monthSummary(data, shiftPeriod(period, -1));
  const byCat = expensesByCategory(data, current.range);
  const topCategories = Object.entries(byCat)
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
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
