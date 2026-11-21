import type { DateRange, ISODate, PeriodKey } from './types';

/** Outils de dates sans fuseau horaire : tous les calculs passent par UTC sur des dates 'AAAA-MM-JJ'. */

export const pad = (n: number) => String(n).padStart(2, '0');

export function makeISO(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseISO(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function isValidISO(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISO(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function toISO(d: Date): ISODate {
  return makeISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

/** m = 1..12. Gère les années bissextiles. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function fromUTC(t: Date): ISODate {
  return makeISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(iso);
  return fromUTC(new Date(Date.UTC(y, m - 1, d + n)));
}

/** Ajoute n mois en gardant le jour `day`, ramené au dernier jour du mois si besoin (31 -> 30, 29/02 -> 28/02). */
export function addMonthsClamped(y: number, m: number, day: number, n: number): ISODate {
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeISO(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

export function inRange(date: ISODate, r: DateRange): boolean {
  return date >= r.start && date <= r.end;
}

/* ----- Périodes budgétaires ----- */

export function periodKey(y: number, m: number): PeriodKey {
  return `${y}-${pad(m)}`;
}

export function parsePeriod(k: PeriodKey): { y: number; m: number } {
  const [y, m] = k.split('-').map(Number);
  return { y, m };
}

export function isValidPeriod(k: unknown): k is PeriodKey {
  return typeof k === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(k);
}

export function shiftPeriod(k: PeriodKey, n: number): PeriodKey {
  const { y, m } = parsePeriod(k);
  const total = y * 12 + (m - 1) + n;
  return periodKey(Math.floor(total / 12), (total % 12) + 1);
}

/** Le mois budgétaire 'AAAA-MM' commence le `startDay` de ce mois et finit la veille du même jour le mois suivant. */
export function periodOf(date: ISODate, startDay = 1): PeriodKey {
  const { y, m, d } = parseISO(date);
  const k = periodKey(y, m);
  return d >= startDay ? k : shiftPeriod(k, -1);
}

export function periodRange(k: PeriodKey, startDay = 1): DateRange {
  const { y, m } = parsePeriod(k);
  const start = makeISO(y, m, startDay);
  const n = parsePeriod(shiftPeriod(k, 1));
  return { start, end: addDays(makeISO(n.y, n.m, startDay), -1) };
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function monthName(m: number): string {
  return MONTHS[m - 1];
}

export function periodLabel(k: PeriodKey, startDay = 1): string {
  const { y, m } = parsePeriod(k);
  if (startDay === 1) return `${MONTHS[m - 1]} ${y}`;
  const r = periodRange(k, startDay);
  return `${formatDateShort(r.start)} – ${formatDateShort(r.end)} ${parseISO(r.end).y}`;
}

export function periodShort(k: PeriodKey): string {
  const { y, m } = parsePeriod(k);
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

export function formatDateShort(iso: ISODate): string {
  const { m, d } = parseISO(iso);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatDateLong(iso: ISODate): string {
  const { y, m, d } = parseISO(iso);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return `${days[wd]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** Jour de la semaine, lundi = 0. */
export function weekdayMon(iso: ISODate): number {
  const { y, m, d } = parseISO(iso);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function periodsBetween(from: PeriodKey, to: PeriodKey): PeriodKey[] {
  const out: PeriodKey[] = [];
  let k = from;
  while (k <= to && out.length < 600) {
    out.push(k);
    k = shiftPeriod(k, 1);
  }
  return out;
}
