import { addDays, addMonthsClamped, daysBetween, parseISO } from './dates';
import type { AppData, DateRange, ISODate, RecurringTransaction } from './types';

/**
 * Les échéances récurrentes ne sont JAMAIS stockées en double : elles sont calculées à la volée.
 * Une échéance devient une vraie opération seulement quand l'utilisateur la confirme ;
 * l'opération garde alors `recurringId` + `occurrenceDate`, ce qui sert de clé anti-doublon.
 */

const STEP_MONTHS: Record<string, number> = { mensuel: 1, trimestriel: 3, annuel: 12 };

/** Toutes les dates d'échéance théoriques d'une récurrence dans une plage (ignore actif/suspendu). */
export function occurrenceDates(rec: Pick<RecurringTransaction, 'frequency' | 'startDate' | 'endDate'>, range: DateRange): ISODate[] {
  const out: ISODate[] = [];
  const last = rec.endDate && rec.endDate < range.end ? rec.endDate : range.end;
  if (last < rec.startDate) return out;

  if (rec.frequency === 'hebdomadaire') {
    let k = Math.max(0, Math.floor(daysBetween(rec.startDate, range.start) / 7));
    for (let date = addDays(rec.startDate, 7 * k); date <= last && out.length < 1000; date = addDays(rec.startDate, 7 * ++k)) {
      if (date >= range.start) out.push(date);
    }
    return out;
  }

  const step = STEP_MONTHS[rec.frequency];
  const s = parseISO(rec.startDate);
  const r = parseISO(range.start);
  const monthsToRange = (r.y - s.y) * 12 + (r.m - s.m);
  let k = Math.max(0, Math.floor(monthsToRange / step) - 1);
  for (let i = 0; i < 1000; i++, k++) {
    const date = addMonthsClamped(s.y, s.m, s.d, k * step);
    if (date > last) break;
    if (date >= range.start && date >= rec.startDate) out.push(date);
  }
  return out;
}

export function isConfirmed(data: Pick<AppData, 'incomes' | 'expenses'>, rec: RecurringTransaction, date: ISODate): boolean {
  const list = rec.kind === 'income' ? data.incomes : data.expenses;
  return list.some((t) => t.recurringId === rec.id && t.occurrenceDate === date);
}

export interface PendingOccurrence {
  rec: RecurringTransaction;
  date: ISODate;
}

/** Échéances prévues, non confirmées, non ignorées, des récurrences actives. */
export function pendingOccurrences(data: Pick<AppData, 'incomes' | 'expenses' | 'recurring'>, range: DateRange): PendingOccurrence[] {
  const out: PendingOccurrence[] = [];
  for (const rec of data.recurring) {
    if (!rec.active) continue;
    for (const date of occurrenceDates(rec, range)) {
      if (rec.skipped.includes(date) || isConfirmed(data, rec, date)) continue;
      out.push({ rec, date });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Prochaine échéance (non confirmée) à partir d'une date. */
export function nextDue(data: Pick<AppData, 'incomes' | 'expenses' | 'recurring'>, rec: RecurringTransaction, from: ISODate): ISODate | undefined {
  if (!rec.active) return undefined;
  const dates = occurrenceDates(rec, { start: from, end: addDays(from, 400) });
  return dates.find((d) => !rec.skipped.includes(d) && !isConfirmed(data, rec, d));
}

export const FREQUENCY_LABEL: Record<string, string> = {
  hebdomadaire: 'Chaque semaine',
  mensuel: 'Chaque mois',
  trimestriel: 'Chaque trimestre',
  annuel: 'Chaque année'
};

/** État d'une récurrence sur une période : son échéance du mois et si elle est confirmée (payée / reçue). */
export function periodStatus(data: Pick<AppData, 'incomes' | 'expenses'>, rec: RecurringTransaction, range: DateRange): { date?: ISODate; confirmed: boolean } {
  const date = occurrenceDates(rec, range).find((d) => !rec.skipped.includes(d));
  return { date, confirmed: !!date && isConfirmed(data, rec, date) };
}

/** Libellé de rythme lisible : « Le 5 de chaque mois », « Chaque semaine »… */
export function scheduleLabel(rec: Pick<RecurringTransaction, 'frequency' | 'startDate'>): string {
  const { d, m } = parseISO(rec.startDate);
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  if (rec.frequency === 'hebdomadaire') return 'Chaque semaine';
  if (rec.frequency === 'trimestriel') return `Le ${d} tous les 3 mois`;
  if (rec.frequency === 'annuel') return `Le ${d} ${MONTHS[m - 1]} chaque année`;
  return `Le ${d} de chaque mois`;
}
