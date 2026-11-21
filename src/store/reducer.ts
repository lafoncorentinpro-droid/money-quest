import { periodOf } from '../domain/dates';
import { initialData } from '../domain/defaults';
import { goalBalance } from '../domain/finance';
import { award, refreshProgress, uid } from '../domain/game';
import type {
  AppData,
  AppSettings,
  Budget,
  Category,
  Equipment,
  Expense,
  ID,
  Income,
  ISODate,
  PeriodKey,
  RecurringTransaction,
  Refund,
  SavingsGoal,
  SavingsMovement
} from '../domain/types';

/**
 * Réducteur PUR : toutes les modifications de données passent par ici.
 * Chaque action porte `today` pour rester déterministe et testable.
 */

type New<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

export type Action =
  | { type: 'income/add'; income: New<Income> }
  | { type: 'income/update'; income: Income }
  | { type: 'income/delete'; id: ID }
  | { type: 'expense/add'; expense: New<Expense> }
  | { type: 'expense/update'; expense: Expense }
  | { type: 'expense/delete'; id: ID }
  | { type: 'refund/add'; expenseId: ID; refund: Omit<Refund, 'id'> }
  | { type: 'refund/delete'; expenseId: ID; refundId: ID }
  | { type: 'recurring/add'; recurring: New<RecurringTransaction> }
  | { type: 'recurring/update'; recurring: RecurringTransaction }
  | { type: 'recurring/delete'; id: ID }
  | { type: 'recurring/confirm'; recurringId: ID; occurrenceDate: ISODate; date: ISODate; amount: number }
  | { type: 'recurring/skip'; recurringId: ID; occurrenceDate: ISODate }
  | { type: 'recurring/unskip'; recurringId: ID; occurrenceDate: ISODate }
  | { type: 'recurring/review'; period: PeriodKey }
  | { type: 'budget/save'; budget: Omit<Budget, 'createdAt' | 'updatedAt' | 'carryOver'> }
  | { type: 'budget/carryOver'; period: PeriodKey; amount: number; fromPeriod: PeriodKey }
  | { type: 'budget/clearCarryOver'; period: PeriodKey }
  | { type: 'category/add'; category: Omit<Category, 'id' | 'custom' | 'archived'> }
  | { type: 'category/update'; category: Category }
  | { type: 'goal/add'; goal: New<SavingsGoal> }
  | { type: 'goal/update'; goal: SavingsGoal }
  | { type: 'goal/delete'; id: ID }
  | { type: 'movement/add'; movement: Omit<SavingsMovement, 'id' | 'createdAt'> }
  | { type: 'movement/delete'; id: ID }
  | { type: 'bilan/view'; period: PeriodKey }
  | { type: 'challenge/set'; period: PeriodKey; categoryId: ID; limit: number }
  | { type: 'challenge/clear' }
  | { type: 'settings/update'; settings: Partial<AppSettings> }
  | { type: 'equip'; equipped: Equipment }
  | { type: 'data/replace'; data: AppData }
  | { type: 'data/reset' };

export type Stamped = Action & { today: ISODate; now?: string };

export class ActionError extends Error {}

const replace = <T extends { id: ID }>(list: T[], item: T) => list.map((x) => (x.id === item.id ? item : x));

export const FREE_GOAL_ID = 'epargne-libre';

/** Un rattachement n'est valable que vers un revenu existant, non annulé, du même mois budgétaire. */
function checkLink(data: AppData, e: Expense): Expense {
  if (!e.incomeId) return e;
  const inc = data.incomes.find((i) => i.id === e.incomeId);
  const sd = data.settings.monthStartDay;
  if (!inc || inc.status === 'annule' || periodOf(inc.date, sd) !== periodOf(e.date, sd)) return { ...e, incomeId: undefined };
  return e;
}

function base(data: AppData, a: Stamped, now: string): AppData {
  switch (a.type) {
    case 'income/add':
      return { ...data, incomes: [...data.incomes, { ...a.income, id: uid('inc'), createdAt: now, updatedAt: now }] };
    case 'income/update': {
      const next = { ...data, incomes: replace(data.incomes, { ...a.income, updatedAt: now }) };
      // Si le revenu change de mois, les dépenses d'un autre mois ne peuvent plus y être rattachées.
      return { ...next, expenses: next.expenses.map((e) => (e.incomeId === a.income.id ? checkLink(next, e) : e)) };
    }
    case 'income/delete':
      return {
        ...data,
        incomes: data.incomes.filter((i) => i.id !== a.id),
        // Les dépenses rattachées deviennent des dépenses générales : rien n'est supprimé.
        expenses: data.expenses.map((e) => (e.incomeId === a.id ? { ...e, incomeId: undefined, updatedAt: now } : e))
      };

    case 'expense/add':
      return {
        ...data,
        expenses: [...data.expenses, checkLink(data, { ...a.expense, refunds: a.expense.refunds ?? [], id: uid('exp'), createdAt: now, updatedAt: now })]
      };
    case 'expense/update':
      return { ...data, expenses: replace(data.expenses, checkLink(data, { ...a.expense, updatedAt: now })) };
    case 'expense/delete':
      return { ...data, expenses: data.expenses.filter((e) => e.id !== a.id) };

    case 'refund/add': {
      const e = data.expenses.find((x) => x.id === a.expenseId);
      if (!e) throw new ActionError('Dépense introuvable.');
      const already = e.refunds.reduce((s, r) => s + r.amount, 0);
      if (a.refund.amount <= 0 || already + a.refund.amount > e.amount) throw new ActionError('Le remboursement dépasse le montant de la dépense.');
      return { ...data, expenses: replace(data.expenses, { ...e, refunds: [...e.refunds, { ...a.refund, id: uid('ref') }], updatedAt: now }) };
    }
    case 'refund/delete': {
      const e = data.expenses.find((x) => x.id === a.expenseId);
      if (!e) return data;
      return { ...data, expenses: replace(data.expenses, { ...e, refunds: e.refunds.filter((r) => r.id !== a.refundId), updatedAt: now }) };
    }

    case 'recurring/add':
      return { ...data, recurring: [...data.recurring, { ...a.recurring, id: uid('rec'), createdAt: now, updatedAt: now }] };
    case 'recurring/update':
      return { ...data, recurring: replace(data.recurring, { ...a.recurring, updatedAt: now }) };
    case 'recurring/delete':
      // Les opérations déjà confirmées restent dans l'historique.
      return { ...data, recurring: data.recurring.filter((r) => r.id !== a.id) };
    case 'recurring/confirm': {
      const rec = data.recurring.find((r) => r.id === a.recurringId);
      if (!rec) throw new ActionError('Récurrence introuvable.');
      const list = rec.kind === 'income' ? data.incomes : data.expenses;
      if (list.some((t) => t.recurringId === rec.id && t.occurrenceDate === a.occurrenceDate)) return data; // anti-doublon
      if (rec.kind === 'income') {
        const inc: Income = {
          id: uid('inc'),
          amount: a.amount,
          date: a.date,
          description: rec.description,
          type: rec.incomeType ?? 'autre',
          status: 'recu',
          recurringId: rec.id,
          occurrenceDate: a.occurrenceDate,
          createdAt: now,
          updatedAt: now
        };
        return { ...data, incomes: [...data.incomes, inc] };
      }
      const exp: Expense = {
        id: uid('exp'),
        amount: a.amount,
        date: a.date,
        categoryId: rec.categoryId ?? 'autres',
        description: rec.description,
        nature: rec.nature,
        status: 'realisee',
        refunds: [],
        recurringId: rec.id,
        occurrenceDate: a.occurrenceDate,
        createdAt: now,
        updatedAt: now
      };
      return { ...data, expenses: [...data.expenses, exp] };
    }
    case 'recurring/skip':
    case 'recurring/unskip': {
      const rec = data.recurring.find((r) => r.id === a.recurringId);
      if (!rec) return data;
      const skipped = a.type === 'recurring/skip' ? [...new Set([...rec.skipped, a.occurrenceDate])] : rec.skipped.filter((d) => d !== a.occurrenceDate);
      return { ...data, recurring: replace(data.recurring, { ...rec, skipped, updatedAt: now }) };
    }
    case 'recurring/review':
      if (data.progress.recurringReviews.includes(a.period)) return data;
      return { ...data, progress: { ...data.progress, recurringReviews: [...data.progress.recurringReviews, a.period] } };

    case 'budget/save': {
      const prev = data.budgets[a.budget.period];
      const b: Budget = {
        ...a.budget,
        categories: a.budget.categories.filter((c) => c.limit > 0),
        carryOver: prev?.carryOver,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now
      };
      return { ...data, budgets: { ...data.budgets, [b.period]: b } };
    }
    case 'budget/carryOver': {
      const prev = data.budgets[a.period];
      const b: Budget = prev ?? { period: a.period, categories: [], savingsTarget: 0, createdAt: now, updatedAt: now };
      return { ...data, budgets: { ...data.budgets, [a.period]: { ...b, carryOver: { amount: a.amount, fromPeriod: a.fromPeriod, recordedAt: now }, updatedAt: now } } };
    }
    case 'budget/clearCarryOver': {
      const prev = data.budgets[a.period];
      if (!prev) return data;
      const { carryOver: _drop, ...rest } = prev;
      void _drop;
      return { ...data, budgets: { ...data.budgets, [a.period]: { ...rest, updatedAt: now } } };
    }

    case 'category/add': {
      const name = a.category.name.trim();
      if (!name) throw new ActionError('Le nom de la catégorie est obligatoire.');
      if (data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && !c.archived)) throw new ActionError('Cette catégorie existe déjà.');
      return { ...data, categories: [...data.categories, { id: uid('cat'), name, icon: a.category.icon || '🏷️', custom: true, archived: false }] };
    }
    case 'category/update':
      return { ...data, categories: replace(data.categories, a.category) };

    case 'goal/add':
      return { ...data, goals: [...data.goals, { ...a.goal, id: uid('goal'), createdAt: now, updatedAt: now }] };
    case 'goal/update':
      return { ...data, goals: replace(data.goals, { ...a.goal, updatedAt: now }) };
    case 'goal/delete':
      if (data.movements.some((m) => m.goalId === a.id || m.toGoalId === a.id)) {
        throw new ActionError('Cet objectif a un historique : mets-le en pause plutôt que de le supprimer, pour garder la trace des mouvements.');
      }
      return { ...data, goals: data.goals.filter((g) => g.id !== a.id) };

    case 'movement/add': {
      let m = a.movement;
      if (m.amount <= 0) throw new ActionError('Le montant doit être supérieur à zéro.');
      // Versement sans objectif précis : il va dans l'enveloppe « Épargne libre », créée au besoin.
      if (!m.goalId) {
        if (m.type !== 'versement') throw new ActionError('Choisis l’objectif concerné.');
        if (!data.goals.some((g) => g.id === FREE_GOAL_ID)) {
          data = { ...data, goals: [...data.goals, { id: FREE_GOAL_ID, name: 'Épargne libre', icon: '🪙', target: 0, paused: false, createdAt: now, updatedAt: now }] };
        }
        m = { ...m, goalId: FREE_GOAL_ID };
      }
      if (!data.goals.some((g) => g.id === m.goalId)) throw new ActionError('Objectif introuvable.');
      if (m.type === 'transfert' && (!m.toGoalId || m.toGoalId === m.goalId || !data.goals.some((g) => g.id === m.toGoalId))) {
        throw new ActionError('Choisis un objectif de destination différent.');
      }
      if (m.type !== 'versement' && m.amount > goalBalance(m.goalId, data.movements)) {
        throw new ActionError('Le montant dépasse le solde de cet objectif.');
      }
      return { ...data, movements: [...data.movements, { ...m, id: uid('mv'), createdAt: now }] };
    }
    case 'movement/delete': {
      const mv = data.movements.find((m) => m.id === a.id);
      if (!mv) return data;
      const rest = data.movements.filter((m) => m.id !== a.id);
      const affected = [mv.goalId, mv.toGoalId].filter(Boolean) as ID[];
      if (affected.some((g) => goalBalance(g, rest) < 0)) throw new ActionError('Supprimer ce versement rendrait le solde de l’objectif négatif. Supprime d’abord les retraits qui en dépendent.');
      return { ...data, movements: rest };
    }

    case 'bilan/view':
      if (data.progress.bilansViewed.includes(a.period)) return data;
      return { ...data, progress: { ...data.progress, bilansViewed: [...data.progress.bilansViewed, a.period] } };

    case 'challenge/set':
      return { ...data, progress: { ...data.progress, categoryChallenge: { period: a.period, categoryId: a.categoryId, limit: a.limit } } };
    case 'challenge/clear': {
      const { categoryChallenge: _c, ...rest } = data.progress;
      void _c;
      return { ...data, progress: rest };
    }

    case 'settings/update': {
      const s = { ...data.settings, ...a.settings };
      s.monthStartDay = 1; // le mois va toujours du 1er au dernier jour
      return { ...data, settings: s };
    }
    case 'equip':
      return { ...data, progress: { ...data.progress, equipped: a.equipped } };

    case 'data/replace':
      return a.data;
    case 'data/reset':
      return initialData(now);
  }
}

/** XP liée aux habitudes — jamais aux montants. */
function grantXp(before: AppData, data: AppData, a: Stamped): AppData {
  const r = data.settings.xpRules;
  const period = periodOf(a.today, data.settings.monthStartDay);
  let p = data.progress;
  switch (a.type) {
    case 'income/add':
    case 'expense/add':
    case 'recurring/confirm':
      if (data !== before) p = award(p, 'saisie', `saisie:${a.today}`, r.saisie, a.today, 'Opérations du jour enregistrées');
      break;
    case 'budget/save':
      if (a.budget.categories.some((c) => c.limit > 0) || a.budget.savingsTarget > 0) {
        p = award(p, 'budget', `budget:${a.budget.period}`, r.budget, a.today, 'Budget du mois préparé');
      }
      break;
    case 'bilan/view':
      p = award(p, 'bilan', `bilan:${a.period}`, r.bilan, a.today, 'Bilan consulté');
      break;
    case 'recurring/review':
      p = award(p, 'revue', `revue:${a.period}`, r.revue, a.today, 'Récurrences vérifiées');
      break;
    case 'movement/add':
      if (a.movement.type === 'versement') p = award(p, 'epargne', `epargne:${a.today}`, r.epargne, a.today, 'Contribution à un objectif');
      break;
  }
  void period;
  return p === data.progress ? data : { ...data, progress: p };
}

export function reduce(data: AppData, a: Stamped): AppData {
  const now = a.now ?? new Date().toISOString();
  const next = base(data, a, now);
  if (a.type === 'data/reset') return next;
  const withXp = grantXp(data, next, a);
  return refreshProgress(withXp, periodOf(a.today, withXp.settings.monthStartDay), a.today);
}
