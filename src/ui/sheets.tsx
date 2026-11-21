import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CategoryForm, ConfirmOccurrenceForm, ExpenseForm, GoalForm, IncomeForm, MovementForm, RecurringForm } from '../forms/forms';
import type { Expense, MovementType, RecurringTransaction } from '../domain/types';
import { useStore } from '../store/store';
import { Sheet } from './components';
import { Icon } from './Icon';

/** Ouverture centralisée des formulaires, depuis n'importe quel écran. */

export type SheetSpec =
  | { kind: 'quick' }
  | { kind: 'expense'; id?: string; preset?: Partial<Expense> }
  | { kind: 'income'; id?: string }
  | { kind: 'recurring'; id?: string; recKind?: 'income' | 'expense' }
  | { kind: 'occurrence'; rec: RecurringTransaction; date: string }
  | { kind: 'goal'; id?: string }
  | { kind: 'movement'; goalId?: string; type?: MovementType }
  | { kind: 'category' };

const Ctx = createContext<(s: SheetSpec) => void>(() => undefined);
export const useSheets = () => useContext(Ctx);

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<SheetSpec | null>(null);
  const close = useCallback(() => setSpec(null), []);
  return (
    <Ctx.Provider value={setSpec}>
      {children}
      {spec && <SheetRenderer spec={spec} close={close} open={setSpec} />}
    </Ctx.Provider>
  );
}

function SheetRenderer({ spec, close, open }: { spec: SheetSpec; close: () => void; open: (s: SheetSpec) => void }) {
  const { data } = useStore();
  switch (spec.kind) {
    case 'quick':
      return (
        <Sheet title="Ajouter" onClose={close}>
          <div className="stack">
            <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 60, justifyContent: 'flex-start' }} onClick={() => open({ kind: 'expense' })}>
              <Icon name="card" size={24} /> Une dépense
            </button>
            <button type="button" className="btn btn-block" style={{ minHeight: 60, justifyContent: 'flex-start' }} onClick={() => open({ kind: 'income' })}>
              <Icon name="arrow-down-circle" size={24} /> Budget de base (salaire…)
            </button>
            <button type="button" className="btn btn-block" style={{ minHeight: 60, justifyContent: 'flex-start' }} onClick={() => open({ kind: 'recurring' })}>
              <Icon name="repeat" size={24} /> Un montant qui revient chaque mois
            </button>
          </div>
        </Sheet>
      );
    case 'expense':
      return <ExpenseForm existing={spec.id ? data.expenses.find((e) => e.id === spec.id) : undefined} preset={spec.preset} onClose={close} />;
    case 'income':
      return <IncomeForm existing={spec.id ? data.incomes.find((e) => e.id === spec.id) : undefined} onClose={close} />;
    case 'recurring':
      return <RecurringForm existing={spec.id ? data.recurring.find((e) => e.id === spec.id) : undefined} kind={spec.recKind} onClose={close} />;
    case 'occurrence':
      return <ConfirmOccurrenceForm rec={spec.rec} occurrenceDate={spec.date} onClose={close} />;
    case 'goal':
      return <GoalForm existing={spec.id ? data.goals.find((g) => g.id === spec.id) : undefined} onClose={close} />;
    case 'movement':
      return <MovementForm goalId={spec.goalId} type={spec.type} onClose={close} />;
    case 'category':
      return <CategoryForm onClose={close} />;
  }
}
