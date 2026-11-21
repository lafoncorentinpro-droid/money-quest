import { parseISO, shiftPeriod } from './dates';
import { sum } from './money';
import type { AppData, Cents, EnvelopeKey, EnvelopeMonth, FixedCharge, ISODate, PeriodKey } from './types';

/**
 * Méthode des enveloppes — calculs PURS et testés.
 * Salaire − dépenses fixes − épargne − 4 semaines = « Achats divers ».
 * Les soldes = montant initial + entrées − sorties (mouvements). Un transfert ne crée ni ne détruit d'argent.
 * Aucun report automatique entre mois : seuls les transferts explicites déplacent de l'argent.
 */

export const WEEKS = 4;
export const LASER: EnvelopeKey = 'laser';
export const EPARGNE: EnvelopeKey = 'epargne';

export const weekKey = (p: PeriodKey, n: number): EnvelopeKey => `${p}:w${n}`;
export const diversKey = (p: PeriodKey): EnvelopeKey => `${p}:divers`;

/** Paramètres de départ (réglage initial de l'utilisateur, modifiables). */
export const DEFAULT_FIXED: Omit<FixedCharge, 'id'>[] = [
  { name: 'Fitness Park', amount: 3000 },
  { name: 'Canal', amount: 2400 },
  { name: 'MACIF', amount: 2500 },
  { name: 'Banque', amount: 500 },
  { name: 'Téléphone', amount: 2100 },
  { name: 'Loyer', amount: 54400 },
  { name: 'Assurance vie', amount: 15000 }
];
export const DEFAULT_SAVINGS = 20000;
export const DEFAULT_WEEKLY = 11000;

export function fixedTotal(m: Pick<EnvelopeMonth, 'fixed'>): Cents {
  return sum(m.fixed.map((f) => f.amount));
}

export interface MonthPlan {
  salary: Cents;
  fixed: Cents;
  savings: Cents;
  weeks: Cents;
  /** Ce qui reste pour les achats divers (peut être négatif si le plan dépasse le salaire). */
  divers: number;
}

export function monthPlan(m: Pick<EnvelopeMonth, 'salary' | 'fixed' | 'savings' | 'weekly'>): MonthPlan {
  const fixed = fixedTotal(m);
  const weeks = m.weekly * WEEKS;
  return { salary: m.salary, fixed, savings: m.savings, weeks, divers: m.salary - fixed - m.savings - weeks };
}

/** Semaine du mois (1 à 4) d'une date : 1–7 → 1, 8–14 → 2, 15–21 → 3, 22 et + → 4. */
export function weekOfDate(date: ISODate): number {
  return Math.min(WEEKS, Math.ceil(parseISO(date).d / 7));
}

function parseKey(key: EnvelopeKey): { period?: PeriodKey; slot: string } {
  const i = key.indexOf(':');
  return i < 0 ? { slot: key } : { period: key.slice(0, i) as PeriodKey, slot: key.slice(i + 1) };
}

/** L'enveloppe existe-t-elle (mois créé pour les enveloppes mensuelles) ? */
export function envelopeExists(env: AppData['envelopes'], key: EnvelopeKey): boolean {
  const { period, slot } = parseKey(key);
  if (!period) return slot === EPARGNE || isProject(env, key);
  if (!env.months[period]) return false;
  return slot === 'divers' || /^w[1-4]$/.test(slot);
}

/** Montant de départ d'une enveloppe (avant mouvements). */
export function initialAmount(env: AppData['envelopes'], key: EnvelopeKey): number {
  const { period, slot } = parseKey(key);
  if (!period) return slot === EPARGNE ? sum(Object.values(env.months).map((m) => m.savings)) : 0;
  const m = env.months[period];
  if (!m) return 0;
  if (slot === 'divers') return monthPlan(m).divers;
  return m.weekly;
}

/** Solde actuel d'une enveloppe. */
export function balance(env: AppData['envelopes'], key: EnvelopeKey): number {
  let b = initialAmount(env, key);
  for (const t of env.tx) {
    if (t.to === key) b += t.amount;
    if (t.from === key) b -= t.amount;
  }
  return b;
}

/** Ce qui est sorti d'une enveloppe en dépenses (pour « dépensé cette semaine »). */
export function spent(env: AppData['envelopes'], key: EnvelopeKey): Cents {
  return sum(env.tx.filter((t) => t.from === key && (t.kind === 'depense' || t.kind === 'seance')).map((t) => t.amount));
}

export function envelopeLabel(key: EnvelopeKey, env?: AppData['envelopes']): string {
  const { period, slot } = parseKey(key);
  if (!period) return slot === EPARGNE ? 'Épargne' : env?.projects.find((p) => p.key === key)?.name ?? 'Projet supprimé';
  if (slot === 'divers') return 'Achats divers';
  return `Semaine ${slot.slice(1)}`;
}

export interface MonthView {
  period: PeriodKey;
  month: EnvelopeMonth;
  plan: MonthPlan;
  weeks: { key: EnvelopeKey; n: number; initial: Cents; balance: number }[];
  divers: { key: EnvelopeKey; initial: number; balance: number };
  /** Disponible du mois = semaines + achats divers (hors épargne et projets). */
  available: number;
}

export function monthView(env: AppData['envelopes'], period: PeriodKey): MonthView | null {
  const month = env.months[period];
  if (!month) return null;
  const plan = monthPlan(month);
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const key = weekKey(period, i + 1);
    return { key, n: i + 1, initial: month.weekly, balance: balance(env, key) };
  });
  const dk = diversKey(period);
  const divers = { key: dk, initial: plan.divers, balance: balance(env, dk) };
  return { period, month, plan, weeks, divers, available: sum(weeks.map((w) => w.balance)) + divers.balance };
}

export function isProject(env: AppData['envelopes'], key: EnvelopeKey): boolean {
  return env.projects.some((p) => p.key === key);
}

export interface ProjectView {
  key: EnvelopeKey;
  name: string;
  balance: number;
  target: Cents;
  remaining: Cents;
  pct: number;
}

/** Projet d'épargne : montant mis de côté, objectif, reste à économiser, progression (0–100). */
export function projectView(env: AppData['envelopes'], key: EnvelopeKey): ProjectView {
  const p = env.projects.find((x) => x.key === key);
  const b = balance(env, key);
  const target = p?.target ?? 0;
  return { key, name: p?.name ?? 'Projet', balance: b, target, remaining: Math.max(0, target - b), pct: target > 0 ? Math.max(0, Math.min(100, Math.round((b / target) * 100))) : 0 };
}

export function projectsView(env: AppData['envelopes']): ProjectView[] {
  return env.projects.map((p) => projectView(env, p.key));
}

/** Paramètres proposés pour créer un mois : ceux du dernier mois existant, sinon les réglages de départ. */
export function nextMonthDefaults(env: AppData['envelopes'], period: PeriodKey): Omit<EnvelopeMonth, 'createdAt' | 'updatedAt'> {
  const previous = Object.keys(env.months)
    .filter((p) => p < period)
    .sort()
    .pop();
  const src = previous ? env.months[previous as PeriodKey] : Object.values(env.months).sort((a, b) => a.period.localeCompare(b.period)).pop();
  if (src) return { period, salary: src.salary, fixed: src.fixed.map((f) => ({ ...f })), savings: src.savings, weekly: src.weekly };
  return { period, salary: 0, fixed: DEFAULT_FIXED.map((f, i) => ({ ...f, id: `fixe-${i + 1}` })), savings: DEFAULT_SAVINGS, weekly: DEFAULT_WEEKLY };
}

/** Enveloppes vers lesquelles on peut déplacer de l'argent depuis un mois donné. */
export function envelopeChoices(env: AppData['envelopes'], period: PeriodKey): EnvelopeKey[] {
  const list: EnvelopeKey[] = [];
  if (env.months[period]) {
    for (let i = 1; i <= WEEKS; i++) list.push(weekKey(period, i));
    list.push(diversKey(period));
  }
  // Le mois précédent reste accessible pour transférer explicitement ses restes.
  const prev = shiftPeriod(period, -1);
  if (env.months[prev]) {
    for (let i = 1; i <= WEEKS; i++) list.push(weekKey(prev, i));
    list.push(diversKey(prev));
  }
  list.push(...env.projects.map((p) => p.key), EPARGNE);
  return list;
}
