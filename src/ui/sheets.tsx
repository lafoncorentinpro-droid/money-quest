import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CategoryForm, ConfirmOccurrenceForm, ExpenseForm, GoalForm, IncomeForm, MovementForm, RecurringForm } from '../forms/forms';
import type { EnvelopeKey, Expense, MovementType, PeriodKey, RecurringTransaction } from '../domain/types';
import { EnvForm, EnvMonthForm, EnvQuickForm, EnvTransferForm } from '../forms/envForms';
import { useStore } from '../store/store';
import { Sheet } from './components';
import { Icon } from './Icon';
import { Mascot } from './Mascot';

/** Ouverture centralisée des formulaires, depuis n'importe quel écran. */

export type SheetSpec =
  | { kind: 'quick' }
  | { kind: 'expense'; id?: string; preset?: Partial<Expense> }
  | { kind: 'income'; id?: string }
  | { kind: 'recurring'; id?: string; recKind?: 'income' | 'expense' }
  | { kind: 'occurrence'; rec: RecurringTransaction; date: string }
  | { kind: 'goal'; id?: string }
  | { kind: 'movement'; goalId?: string; type?: MovementType }
  | { kind: 'category' }
  | { kind: 'env-month'; period: PeriodKey }
  | { kind: 'env'; key: EnvelopeKey }
  | { kind: 'env-transfer'; from?: EnvelopeKey }
  | { kind: 'env-quick' };

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
  const { data, month } = useStore();
  switch (spec.kind) {
    case 'env-month':
      return <EnvMonthForm period={spec.period} onClose={close} />;
    case 'env':
      return <EnvForm envKey={spec.key} onClose={close} onTransfer={() => open({ kind: 'env-transfer', from: spec.key })} />;
    case 'env-transfer':
      return <EnvTransferForm from={spec.from} onClose={close} />;
    case 'env-quick':
      return <EnvQuickForm onClose={close} onCreate={() => open({ kind: 'env-month', period: month })} />;
    case 'quick':
      return (
        <Sheet title="Ajouter" subtitle="Qu’est-ce que tu veux noter ?" onClose={close}>
          <div className="stack">
            {(
              [
                ['expense', 'card', 'is-blue', 'Une dépense', 'Courses, resto, transport… payée ou prévue'],
                ['income', 'arrow-down-circle', 'is-green', 'Budget de base', 'Salaire, prime, aide… l’argent du mois'],
                ['recurring', 'repeat', 'is-gold', 'Une dépense récurrente', 'Loyer, abonnement, forfait… chaque mois']
              ] as const
            ).map(([kind, icon, tone, title, desc]) => (
              <button key={kind} type="button" className="btn add-option" onClick={() => open({ kind } as SheetSpec)}>
                <span className={`add-ico ${tone}`}>
                  <Icon name={icon} size={26} />
                </span>
                <span className="grow">
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </span>
                <Icon name="chevron-right" size={20} />
              </button>
            ))}
          </div>
          <div className="add-tip">
            <Mascot id={data.settings.mascot} size={64} hello animate={data.settings.animations} />
            <div className="speech">Astuce : note tes dépenses le jour même, c’est plus facile !</div>
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
