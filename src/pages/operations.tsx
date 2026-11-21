import { formatDateLong, inRange } from '../domain/dates';
import { INCOME_TYPE_LABEL } from '../domain/defaults';
import { isFullyRefunded, netExpense } from '../domain/finance';
import { pendingOccurrences } from '../domain/recurring';
import type { AppData, DateRange, RecurringTransaction } from '../domain/types';
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
        [e.description ? c?.name : 'Dépense', e.nature === 'fixe' ? 'fixe' : 'variable', refunded ? (isFullyRefunded(e) ? 'remboursée' : 'remb. partiel') : null].filter(Boolean).join(' · '),
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
      subtitle: i.description && i.description !== INCOME_TYPE_LABEL[i.type] ? `Budget de base · ${INCOME_TYPE_LABEL[i.type]}` : i.recurringId ? 'Budget de base · récurrent' : 'Budget de base',
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
        subtitle: 'Échéance récurrente à confirmer',
        icon: p.rec.kind === 'income' ? '💧' : c?.icon ?? '🔁',
        planned: true,
        cancelled: false,
        categoryId: p.rec.categoryId,
        nature: p.rec.nature,
        statusLabel: 'Prévu',
        open: { kind: 'occurrence', rec: p.rec, date: p.date },
        rec: p.rec
      });
    }
  }
  return rows;
}

export function OpRowView({ row, money, onOpen, showDate }: { row: OpRow; money: (c: number) => string; onOpen: (s: SheetSpec) => void; showDate?: boolean }) {
  const tone = row.cancelled ? 'muted' : row.sign === '+' ? 'pos' : '';
  return (
    <button type="button" className={`list-row ${row.planned ? 'planned-row' : ''}`} onClick={() => onOpen(row.open)}>
      <span className="icon-bubble" aria-hidden>
        {row.icon}
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="ellipsis" style={{ textDecoration: row.cancelled ? 'line-through' : undefined }}>
          {row.title}
        </div>
        <div className="tiny ellipsis">
          {showDate && `${formatDateLong(row.date)} · `}
          {row.subtitle}
        </div>
      </div>
      <div className="stack" style={{ alignItems: 'flex-end', gap: 2 }}>
        <span className={`num ${tone}`} style={{ fontWeight: 600 }}>
          {row.sign === '⇄' ? '' : row.sign}
          {money(row.amount)}
        </span>
        {(row.planned || row.cancelled) && <span className={`tag ${row.planned ? 'tag-planned' : ''}`}>{row.statusLabel}</span>}
        {row.kind === 'movement' && <span className="tag">Épargne</span>}
      </div>
    </button>
  );
}
