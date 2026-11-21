import { describe, expect, it } from 'vitest';
import { initialData } from '../src/domain/defaults';
import { balance, diversKey, EPARGNE, fixedTotal, LASER, monthView, projectView, projectsView, nextMonthDefaults, weekKey, weekOfDate } from '../src/domain/envelopes';
import { migrate } from '../src/domain/backup';
import { reduce, type Action } from '../src/store/reducer';
import type { AppData } from '../src/domain/types';

const T = '2026-11-15';
const run = (d: AppData, ...actions: Action[]) => actions.reduce((acc, a) => reduce(acc, { ...a, today: T } as never), d);
const P = '2026-11';
const create = (d: AppData, salary = 190000) => run(d, { type: 'env/month/save', month: { ...nextMonthDefaults(d.envelopes, P), salary } });

describe('méthode des enveloppes', () => {
  it('répartit le salaire : 1 900 € − 799 € de fixes − 200 € d’épargne − 4 × 110 € = 461 € d’achats divers', () => {
    const d = create(initialData());
    const v = monthView(d.envelopes, P)!;
    expect(fixedTotal(v.month)).toBe(79900); // calculé à partir des montants, pas écrit en dur
    expect(v.plan.savings).toBe(20000);
    expect(v.weeks.map((w) => w.balance)).toEqual([11000, 11000, 11000, 11000]);
    expect(v.divers.balance).toBe(46100);
    expect(balance(d.envelopes, EPARGNE)).toBe(20000);
  });

  it('une dépense de 25 € sur la semaine 1 laisse 85 €', () => {
    const d = run(create(initialData()), { type: 'env/tx/add', tx: { date: T, kind: 'depense', from: weekKey(P, 1), amount: 2500 } });
    expect(balance(d.envelopes, weekKey(P, 1))).toBe(8500);
  });

  it('un transfert déplace l’argent sans en créer ni en détruire', () => {
    let d = create(initialData());
    const before = monthView(d.envelopes, P)!.available + balance(d.envelopes, LASER);
    d = run(d, { type: 'env/tx/add', tx: { date: T, kind: 'transfert', from: weekKey(P, 1), to: LASER, amount: 1500 } });
    expect(balance(d.envelopes, weekKey(P, 1))).toBe(9500);
    expect(projectView(d.envelopes, LASER)).toEqual({ key: 'laser', name: 'Prochaine séance laser', balance: 1500, target: 13700, remaining: 12200, pct: 11 });
    expect(monthView(d.envelopes, P)!.available + balance(d.envelopes, LASER)).toBe(before);
  });

  it('la séance payée remet l’enveloppe laser à zéro, de façon tracée', () => {
    let d = run(create(initialData()), { type: 'env/tx/add', tx: { date: T, kind: 'ajout', to: LASER, amount: 13700 } });
    d = run(d, { type: 'env/tx/add', tx: { date: T, kind: 'seance', from: LASER, amount: 13700 } });
    expect(balance(d.envelopes, LASER)).toBe(0);
    expect(d.envelopes.tx).toHaveLength(2);
  });

  it('un nouveau mois reprend les paramètres du précédent, sans reporter ses soldes', () => {
    let d = run(create(initialData()), { type: 'env/tx/add', tx: { date: T, kind: 'depense', from: diversKey(P), amount: 10000 } });
    const dec = nextMonthDefaults(d.envelopes, '2026-12');
    expect(dec.salary).toBe(190000);
    expect(dec.fixed).toHaveLength(7);
    d = run(d, { type: 'env/month/save', month: dec });
    expect(balance(d.envelopes, diversKey('2026-12'))).toBe(46100); // pas de report implicite
    expect(balance(d.envelopes, EPARGNE)).toBe(40000); // l'épargne s'accumule
  });

  it('refuse un transfert vers la même enveloppe ou un mois inexistant', () => {
    const d = create(initialData());
    expect(() => run(d, { type: 'env/tx/add', tx: { date: T, kind: 'transfert', from: LASER, to: LASER, amount: 100 } })).toThrow();
    expect(() => run(d, { type: 'env/tx/add', tx: { date: T, kind: 'depense', from: weekKey('2027-01', 1), amount: 100 } })).toThrow();
  });

  it('semaine du mois selon le jour', () => {
    expect(['2026-11-01', '2026-11-07', '2026-11-08', '2026-11-21', '2026-11-22', '2026-11-30'].map(weekOfDate)).toEqual([1, 1, 2, 3, 4, 4]);
  });

  it('migrations v4 et v5 : enveloppes vides puis le laser devient un projet', () => {
    const m = migrate({ schemaVersion: 3, settings: {} }) as { schemaVersion: number; envelopes: { tx: unknown[]; projects: unknown[]; laserTarget?: number } };
    expect(m.schemaVersion).toBe(5);
    expect(m.envelopes.tx).toEqual([]);
    expect(m.envelopes.projects).toEqual([{ key: 'laser', name: 'Prochaine séance laser', target: 13700 }]);
    expect(m.envelopes.laserTarget).toBeUndefined();
    const kept = migrate({ schemaVersion: 4, envelopes: { months: {}, tx: [], laserTarget: 15000 } }) as { envelopes: { projects: { target: number }[] } };
    expect(kept.envelopes.projects[0].target).toBe(15000);
  });

  it('on peut ajouter un projet (gros achat), l’alimenter, le régler et le supprimer une fois vide', () => {
    let d = run(create(initialData()), { type: 'env/project/save', name: 'Nouveau vélo', target: 60000 });
    const key = d.envelopes.projects[1].key;
    expect(projectsView(d.envelopes).map((p) => p.name)).toEqual(['Prochaine séance laser', 'Nouveau vélo']);
    d = run(d, { type: 'env/tx/add', tx: { date: T, kind: 'transfert', from: diversKey(P), to: key, amount: 10000 } });
    expect(projectView(d.envelopes, key).pct).toBe(17);
    expect(() => run(d, { type: 'env/project/delete', key })).toThrow();
    d = run(d, { type: 'env/tx/add', tx: { date: T, kind: 'seance', from: key, amount: 10000 } });
    d = run(d, { type: 'env/project/delete', key });
    expect(d.envelopes.projects).toHaveLength(1);
  });
});
