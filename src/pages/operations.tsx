import { formatDateLong, inRange } from '../domain/dates';
import { INCOME_TYPE_LABEL } from '../domain/defaults';
import { isFullyRefunded, netExpense } from '../domain/finance';
import { pendingOccurrences } from '../domain/recurring';
import type { AppData, DateRange, RecurringTransaction } from '../domain/types';
import { CatIcon, hasCatIcon } from '../ui/CatIcon';
import type { SheetSpec } from '../ui/sheets';

/** Vue unifiée des opérations d'une plage, pour les listes et le calendrier. */

export type RowKind = 'income' | 'expense' | 'movement' | 'occurrence';

export interface OpRow {
  key: string;
  date: string;
  kind: RowKind;
  amount: number; // montant affiché (net pour les dépenses)
  sign: '+' | '−' | '⇄';
  title: string;
  subtitle: string;
  /** Libellé court (catégorie) pour les listes compactes. */
  label: string;
  icon: string;
  planned: boolean;
  cancelled: boolean;
  categoryId?: string;
  nature?: 'fixe' | 'variable';
  statusLabel: string;
  open: SheetSpec;
  rec?: RecurringTransaction;
}

export function buildRows(data: AppData, range: DateRange, includePlanned = true): OpRow[] {
  const cat = new Map(data.categories.map((c) => [c.id, c]));
  const goal = new Map(data.goals.map((g) => [g.id, g]));
  const rows: OpRow[] = [];

  for (const e of data.expenses) {
    if (!inRange(e.date, range)) continue;
    const c = cat.get(e.categoryId);
    const refunded = e.refunds.length > 0;
    rows.push({
      key: e.id,
      date: e.date,
      kind: 'expense',
      amount: netExpense(e),
      sign: '−',
      title: e.description || c?.name || 'Dépense',
      subtitle:
        [c?.name ?? 'Dépense', e.nature === 'fixe' ? 'Fixe' : 'Variable', refunded ? (isFullyRefunded(e) ? 'remboursée' : 'remb. partiel') : null].filter(Boolean).join(' · '),
      label: c?.name ?? 'Dépense',
      icon: c?.icon ?? '🪙',
      planned: e.status === 'prevue',
      cancelled: e.status === 'annulee',
      categoryId: e.categoryId,
      nature: e.nature,
      statusLabel: e.status === 'prevue' ? 'Prévue' : e.status === 'annulee' ? 'Annulée' : 'Réalisée',
      open: { kind: 'expense', id: e.id }
    });
  }
  for (const i of data.incomes) {
    if (!inRange(i.date, range)) continue;
    rows.push({
      key: i.id,
      date: i.date,
      kind: 'income',
      amount: i.amount,
      sign: '+',
      title: i.description || INCOME_TYPE_LABEL[i.type],
      subtitle: `Budget de base · ${i.status === 'prevu' ? 'Prévu' : i.status === 'annule' ? 'Annulé' : 'Reçu'}`,
      label: 'Budget de base',
      icon: '💧',
      planned: i.status === 'prevu',
      cancelled: i.status === 'annule',
      statusLabel: i.status === 'prevu' ? 'Prévu' : i.status === 'annule' ? 'Annulé' : 'Reçu',
      open: { kind: 'income', id: i.id }
    });
  }
  for (const m of data.movements) {
    if (!inRange(m.date, range)) continue;
    const g = goal.get(m.goalId);
    const to = m.toGoalId ? goal.get(m.toGoalId) : undefined;
    rows.push({
      key: m.id,
      date: m.date,
      kind: 'movement',
      amount: m.amount,
      sign: m.type === 'versement' ? '−' : m.type === 'retrait' ? '+' : '⇄',
      title: m.type === 'transfert' ? `${g?.name} → ${to?.name}` : `${m.type === 'versement' ? 'Versement' : 'Retrait'} · ${g?.name}`,
      subtitle: 'Transfert interne (épargne)',
      label: 'Épargne',
      icon: g?.icon ?? '🧰',
      planned: false,
      cancelled: false,
      statusLabel: 'Effectué',
      open: { kind: 'movement', goalId: m.goalId }
    });
  }
  if (includePlanned) {
    for (const p of pendingOccurrences(data, range)) {
      const c = p.rec.categoryId ? cat.get(p.rec.categoryId) : undefined;
      rows.push({
        key: `${p.rec.id}@${p.date}`,
        date: p.date,
        kind: 'occurrence',
        amount: p.rec.amount,
        sign: p.rec.kind === 'income' ? '+' : '−',
        title: p.rec.description,
        subtitle: p.rec.kind === 'income' ? 'Budget de base · à confirmer' : `${c?.name ?? 'Récurrente'} · à confirmer`,
        label: p.rec.kind === 'income' ? 'Budget de base' : c?.name ?? 'Récurrente',
        icon: p.rec.kind === 'income' ? '💧' : c?.icon ?? '🔁',
        planned: true,
        cancelled: false,
        categoryId: p.rec.categoryId,
        nature: p.rec.nature,
        statusLabel: p.rec.kind === 'income' ? 'Prévu' : 'Prévue',
        open: { kind: 'occurrence', rec: p.rec, date: p.date },
        rec: p.rec
      });
    }
  }
  return rows;
}

/** Ligne d'opération (maquettes) : pastille d'icône, nom + étiquette « Prévue », sous-titre, montant. */
export function OpRowView({ row, money, onOpen, showDate, dateLabel }: { row: OpRow; money: (c: number) => string; onOpen: (s: SheetSpec) => void; showDate?: boolean; dateLabel?: string }) {
  const tone = row.cancelled ? 'muted' : row.sign === '+' ? 'pos' : '';
  const isIncome = row.kind === 'income' || (row.kind === 'occurrence' && row.sign === '+');
  const iconId = isIncome ? '_income' : row.kind === 'occurrence' ? (hasCatIcon(row.categoryId) ? row.categoryId : '_recurring') : row.categoryId;
  const sub = dateLabel ? `${dateLabel} · ${row.label}` : [showDate ? formatDateLong(row.date) : null, row.subtitle].filter(Boolean).join(' · ');
  return (
    <button type="button" className="list-row op-row" onClick={() => onOpen(row.open)}>
      <CatIcon id={iconId} fallback={row.icon} size={42} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="op-title">
          <span className="ellipsis" style={{ textDecoration: row.cancelled ? 'line-through' : undefined }}>
            {row.title}
          </span>
          {(row.planned || row.cancelled) && <span className={`tag ${row.planned ? 'tag-gold' : ''}`}>{row.statusLabel}</span>}
        </div>
        <div className="op-sub ellipsis">{sub}</div>
      </div>
      <span className={`op-amount num ${tone}`}>
        {row.sign === '⇄' ? '' : row.sign + ' '}
        {money(row.amount)}
      </span>
    </button>
  );
}
