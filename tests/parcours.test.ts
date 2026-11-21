import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from '../src/domain/backup';
import { initialData } from '../src/domain/defaults';
import { buildBilan, goalBalance, monthSummary } from '../src/domain/finance';
import { totalXp } from '../src/domain/game';
import { pendingOccurrences } from '../src/domain/recurring';
import { periodRange } from '../src/domain/dates';
import { loadData, saveData } from '../src/store/db';
import { reduce, type Action } from '../src/store/reducer';
import type { AppData } from '../src/domain/types';

/** Parcours utilisateur de bout en bout, joués sur le vrai réducteur et le vrai stockage IndexedDB (simulé). */

const step = (d: AppData, a: Action, today = '2026-11-03') => reduce(d, { ...a, today } as never);

describe('parcours utilisateur', () => {
  it('1 → 8 : première ouverture jusqu’à la restauration', async () => {
    // 1. Première ouverture : aucune donnée fictive
    const first = await loadData();
    expect(first.status).toBe('new');
    let d = first.data;
    expect(d.incomes.length + d.expenses.length + d.goals.length).toBe(0);
    expect(monthSummary(d, '2026-11').available).toBe(0);

    // 2. Configuration du salaire (récurrent) puis confirmation de réception
    d = step(d, { type: 'recurring/add', recurring: { kind: 'income', amount: 215000, description: 'Salaire', incomeType: 'salaire', nature: 'fixe', frequency: 'mensuel', startDate: '2026-11-01', active: true, skipped: [] } });
    d = step(d, { type: 'recurring/add', recurring: { kind: 'expense', amount: 72000, description: 'Loyer', categoryId: 'logement', nature: 'fixe', frequency: 'mensuel', startDate: '2026-11-05', active: true, skipped: [] } });
    expect(monthSummary(d, '2026-11').incomesReceived).toBe(0); // pas reçu avant confirmation
    const sal = d.recurring[0];
    d = step(d, { type: 'recurring/confirm', recurringId: sal.id, occurrenceDate: '2026-11-01', date: '2026-11-01', amount: 215000 });
    expect(monthSummary(d, '2026-11').incomesReceived).toBe(215000);

    // 3. Création du budget
    d = step(d, { type: 'budget/save', budget: { period: '2026-11', savingsTarget: 20000, categories: [{ categoryId: 'courses', limit: 35000 }, { categoryId: 'loisirs', limit: 10000 }] } });
    expect(d.progress.achievements['premier-budget']).toBeDefined();

    // 4. Ajout d'une dépense
    d = step(d, { type: 'expense/add', expense: { amount: 4590, date: '2026-11-03', categoryId: 'courses', description: 'Marché', nature: 'variable', status: 'realisee', refunds: [] } });
    const s4 = monthSummary(d, '2026-11');
    expect(s4.expensesRealized).toBe(4590);
    expect(s4.categories.find((c) => c.categoryId === 'courses')?.remaining).toBe(30410);

    // 5. Création d'un objectif
    d = step(d, { type: 'goal/add', goal: { name: 'Vacances', icon: '🏝️', target: 80000, paused: false } });

    // 6. Versement d'épargne
    d = step(d, { type: 'movement/add', movement: { goalId: d.goals[0].id, type: 'versement', amount: 20000, date: '2026-11-03' } });
    const s6 = monthSummary(d, '2026-11');
    expect(goalBalance(d.goals[0].id, d.movements)).toBe(20000);
    expect(s6.expensesRealized).toBe(4590); // pas une dépense
    expect(s6.available).toBe(215000 - 4590 - 20000);
    expect(s6.expensesPlanned).toBe(72000); // loyer encore prévu
    expect(s6.forecast).toBe(s6.available - 72000);

    // 7. Consultation du bilan
    d = step(d, { type: 'bilan/view', period: '2026-11' });
    const b = buildBilan(d, '2026-11', (c) => String(c));
    expect(b.positives.length).toBeGreaterThan(0);
    expect(b.topCategories[0].categoryId).toBe('courses');
    expect(totalXp(d.progress)).toBeGreaterThan(0);

    // Persistance : fermeture / réouverture
    await saveData(d);
    const reopened = await loadData();
    expect(reopened.status).toBe('ok');
    expect(reopened.data).toEqual(d);
    // Réouverture le mois suivant : pas de doublon de loyer
    expect(pendingOccurrences(reopened.data, periodRange('2026-11')).length).toBe(1);

    // 8. Export puis restauration
    const file = JSON.stringify(makeBackup(d));
    let wiped = step(d, { type: 'data/reset' });
    expect(wiped.expenses).toHaveLength(0);
    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) wiped = step(wiped, { type: 'data/replace', data: parsed.data });
    expect(monthSummary(wiped, '2026-11')).toEqual(monthSummary(d, '2026-11'));
    expect(wiped.goals).toEqual(d.goals);
  });

  it('un mois difficile ne retire rien', () => {
    let d = initialData();
    d = step(d, { type: 'budget/save', budget: { period: '2026-11', savingsTarget: 0, categories: [{ categoryId: 'loisirs', limit: 1000 }] } });
    d = step(d, { type: 'expense/add', expense: { amount: 50000, date: '2026-11-03', categoryId: 'loisirs', description: '', nature: 'variable', status: 'realisee', refunds: [] } });
    const xp = totalXp(d.progress);
    const badges = Object.keys(d.progress.achievements).length;
    d = step(d, { type: 'expense/add', expense: { amount: 90000, date: '2026-11-04', categoryId: 'loisirs', description: '', nature: 'variable', status: 'realisee', refunds: [] } }, '2026-11-04');
    expect(totalXp(d.progress)).toBeGreaterThanOrEqual(xp);
    expect(Object.keys(d.progress.achievements).length).toBeGreaterThanOrEqual(badges);
    expect(d.progress.unlockedRegions.village).toBeDefined();
  });

  it('défi de catégorie validé seulement après la fin du mois', () => {
    let d = initialData();
    d = step(d, { type: 'challenge/set', period: '2026-11', categoryId: 'restaurants', limit: 5000 });
    d = step(d, { type: 'expense/add', expense: { amount: 3000, date: '2026-11-03', categoryId: 'restaurants', description: '', nature: 'variable', status: 'realisee', refunds: [] } });
    expect(d.progress.missionCompletions.some((c) => c.missionId === 'limite-categorie')).toBe(false);
    d = step(d, { type: 'bilan/view', period: '2026-11' }, '2026-12-01');
    expect(d.progress.missionCompletions.some((c) => c.missionId === 'limite-categorie' && c.period === '2026-11')).toBe(true);
  });
});
