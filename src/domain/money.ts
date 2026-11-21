import type { Cents } from './types';

export const MAX_CENTS = 100_000_000_00; // 100 millions : garde-fou de saisie

/**
 * Convertit une saisie utilisateur en centimes entiers (jamais de flottant).
 * Accepte "12", "12,5", "12.50", "1 234,56", "45 €". Refuse le négatif et plus de 2 décimales.
 */
export function parseAmount(input: string): Cents | null {
  const s = input.replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  const cents = Number(int) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
  return cents;
}

export function isCents(n: unknown): n is Cents {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= MAX_CENTS;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatCents(cents: number, currency = 'EUR'): string {
  let f = formatters.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat('fr-FR', { style: 'currency', currency });
    } catch {
      f = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
    }
    formatters.set(currency, f);
  }
  // Division uniquement pour l'affichage : les calculs restent en entiers.
  return f.format(cents / 100);
}

/** Pour pré-remplir un champ de saisie. */
export function centsToInput(cents: Cents): string {
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Pourcentage entier borné 0..100 (affichage). */
export function percent(part: number, total: number): number {
  if (total <= 0) return part > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
