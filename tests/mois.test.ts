import { describe, expect, it } from 'vitest';
import { initialData } from '../src/domain/defaults';
import { goalBalance, incomeUsage, monthFlow, monthSummary } from '../src/domain/finance';
import { FREE_GOAL_ID, reduce, type Action } from '../src/store/reducer';
import type { AppData } from '../src/domain/types';

const run = (d: AppData, ...actions: Action[]) => actions.reduce((acc, a) => reduce(acc, { ...a, today: '2026-11-15' } as never), d);
const inc = (amount: number, date: string, description: string, extra: Record<string, unknown> = {}): Action => ({
  type: 'income/add',
  income: { amount, date, description, type: 'salaire', status: 'recu', ...extra } as never
});
const exp = (amount: number, date: string, extra: Record<string, unknown> = {}): Action => ({
  type: 'expense/add',
  expense: { amount, date, categoryId: 'courses', description: '', nature: 'variable', status: 'realisee', refunds: [], ...extra } as never
});

/** Le scénario exact du cahier des charges : salaire 1 750 €, prime 150 €. */
function novembre() {
  let d = run(initialData(), inc(175000, '2026-11-01', 'Salaire'), inc(15000, '2026-11-10', 'Prime', { type: 'prime' }));
  const [salaire, prime] = d.incomes;
  d = run(d, exp(50000, '2026-11-05', { incomeId: salaire.id }), exp(10000, '2026-11-06'));
  return { d, salaire, prime };
}

describe('gestion mensuelle', () => {
  it('revenus multiples dans le même mois', () => {
    const { d } = novembre();
    const f = monthFlow(d, '2026-11');
    expect(f.incomesReceived).toBe(190000);
    expect(f.incomesExpected).toBe(190000);
  });

  it('dépense rattachée à un revenu : jamais comptée deux fois', () => {
    const { d, salaire, prime } = novembre();
    const f = monthFlow(d, '2026-11');
    expect(f.expensesPaid).toBe(60000); // 500 + 100, pas 1 100
    const u = Object.fromEntries(incomeUsage(d, '2026-11').map((x) => [x.incomeId ?? 'general', x]));
    expect(u[salaire.id].paid).toBe(50000);
    expect(u[salaire.id].remaining).toBe(125000);
    expect(u[prime.id].paid).toBe(0);
    expect(u.general.paid).toBe(10000);
    const totalUsage = incomeUsage(d, '2026-11').reduce((a, x) => a + x.paid, 0);
    expect(totalUsage).toBe(f.expensesPaid);
  });

  it('reste disponible = reçus − payées − versements + retraits', () => {
    let { d } = novembre();
    d = run(d, { type: 'goal/add', goal: { name: 'Voyage', icon: '✈️', target: 100000, paused: false } });
    const g = d.goals[0].id;
    d = run(
      d,
      { type: 'movement/add', movement: { goalId: g, type: 'versement', amount: 25000, date: '2026-11-12' } },
      { type: 'movement/add', movement: { goalId: g, type: 'retrait', amount: 5000, date: '2026-11-20' } }
    );
    const f = monthFlow(d, '2026-11');
    expect(f.resteDisponible).toBe(190000 - 60000 - 25000 + 5000);
    expect(f.savingsNet).toBe(20000);
    expect(f.expensesPaid).toBe(60000); // l'épargne n'est pas une dépense
    expect(f.savingsRate).toBeCloseTo(10.5, 1);
  });

  it('prévu et payé distingués', () => {
    let { d } = novembre();
    d = run(d, exp(3000, '2026-11-25', { status: 'prevue' }), inc(2000, '2026-11-28', 'Aide', { status: 'prevu', type: 'aide' }));
    const f = monthFlow(d, '2026-11');
    expect(f.expensesPaid).toBe(60000);
    expect(f.expensesPlanned).toBe(3000);
    expect(f.expensesExpected).toBe(63000);
    expect(f.incomesReceived).toBe(190000);
    expect(f.incomesExpected).toBe(192000);
  });

  it('changer de mois ne mélange ni ne déplace rien', () => {
    let { d } = novembre();
    d = run(d, inc(180000, '2026-12-01', 'Salaire'));
    expect(monthFlow(d, '2026-12').incomesReceived).toBe(180000);
    expect(monthFlow(d, '2026-12').expensesPaid).toBe(0);
    expect(monthFlow(d, '2026-11').incomesReceived).toBe(190000);
    expect(monthFlow(d, '2026-10').incomesExpected).toBe(0);
    expect(monthFlow(d, '2026-10').stage).toBe('revenus');
  });

  it('un revenu n’est jamais copié dans un autre mois sans récurrence', () => {
    const { d } = novembre();
    expect(monthFlow(d, '2026-12').incomesExpected).toBe(0);
  });

  it('rattachement impossible vers un revenu d’un autre mois', () => {
    const { d: d0, salaire } = novembre();
    const d = run(d0, exp(1000, '2026-12-03', { incomeId: salaire.id }));
    expect(d.expenses[d.expenses.length - 1].incomeId).toBeUndefined();
  });

  it('supprimer un revenu garde ses dépenses en « général »', () => {
    const { d: d0, salaire } = novembre();
    const d = run(d0, { type: 'income/delete', id: salaire.id });
    expect(d.expenses).toHaveLength(2);
    expect(d.expenses.every((e) => !e.incomeId)).toBe(true);
    expect(monthFlow(d, '2026-11').expensesPaid).toBe(60000);
  });

  it('versement sans objectif : enveloppe « Épargne libre »', () => {
    let { d } = novembre();
    d = run(d, { type: 'movement/add', movement: { goalId: '', type: 'versement', amount: 18000, date: '2026-11-15' } });
    d = run(d, { type: 'movement/add', movement: { goalId: '', type: 'versement', amount: 2000, date: '2026-11-16' } });
    expect(d.goals.filter((g) => g.id === FREE_GOAL_ID)).toHaveLength(1);
    expect(goalBalance(FREE_GOAL_ID, d.movements)).toBe(20000);
    expect(d.progress.achievements['objectif-atteint']).toBeUndefined(); // pas de cible = pas « atteint »
    expect(monthSummary(d, '2026-11').savingsNet).toBe(20000);
  });

  it('étapes du parcours : revenus → dépenses → épargne → complet', () => {
    let d = initialData();
    expect(monthFlow(d, '2026-11').stage).toBe('revenus');
    d = run(d, inc(100000, '2026-11-01', 'Salaire'));
    expect(monthFlow(d, '2026-11').stage).toBe('depenses');
    d = run(d, exp(1000, '2026-11-02'));
    expect(monthFlow(d, '2026-11').stage).toBe('epargne');
    d = run(d, { type: 'movement/add', movement: { goalId: '', type: 'versement', amount: 500, date: '2026-11-03' } });
    expect(monthFlow(d, '2026-11').stage).toBe('complet');
  });
});
