import { useState } from 'react';
import { formatDateShort, isValidISO } from '../domain/dates';
import { GOAL_TEMPLATES, INCOME_TYPE_LABEL } from '../domain/defaults';
import { goalBalance, netExpense, refundedAmount } from '../domain/finance';
import { FREQUENCY_LABEL } from '../domain/recurring';
import type { Expense, ExpenseStatus, Frequency, Income, IncomeStatus, IncomeType, MovementType, Nature, RecurringTransaction, SavingsGoal } from '../domain/types';
import { useStore } from '../store/store';
import { AmountField, Confirm, Field, Sheet, Switch, useAmount } from '../ui/components';

/* ======================= Dépense ======================= */

export function ExpenseForm({ existing, onClose, preset }: { existing?: Expense; onClose: () => void; preset?: Partial<Expense> }) {
  const { data, dispatch, today, toast, money } = useStore();
  const init = existing ?? preset;
  const amount = useAmount(init?.amount);
  const [categoryId, setCategoryId] = useState(init?.categoryId ?? '');
  const [date, setDate] = useState(init?.date ?? today);
  const [description, setDescription] = useState(init?.description ?? '');
  const [nature, setNature] = useState<Nature>(init?.nature ?? 'variable');
  const [status, setStatus] = useState<ExpenseStatus>(init?.status ?? (init?.date && init.date > today ? 'prevue' : 'realisee'));
  const [note, setNote] = useState(init?.note ?? '');
  const [showMore, setShowMore] = useState(!!existing);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refundAmt = useAmount();
  const [refundDate, setRefundDate] = useState(today);

  const cats = data.categories.filter((c) => !c.archived || c.id === categoryId);
  const errors = {
    amount: !amount.valid,
    category: !categoryId,
    date: !isValidISO(date)
  };
  const invalid = errors.amount || errors.category || errors.date;

  const save = () => {
    setTried(true);
    amount.setTouched(true);
    if (invalid) return;
    const fields = { amount: amount.cents!, categoryId, date, description: description.trim(), nature, status, note: note.trim() || undefined };
    if (existing) {
      if (fields.amount < refundedAmount(existing)) {
        toast('Le montant ne peut pas être inférieur aux remboursements déjà enregistrés.', 'error');
        return;
      }
      if (dispatch({ type: 'expense/update', expense: { ...existing, ...fields } })) {
        toast('Dépense modifiée', 'success');
        onClose();
      }
    } else if (dispatch({ type: 'expense/add', expense: { ...fields, refunds: [] } })) {
      toast(status === 'prevue' ? 'Dépense prévue ajoutée' : 'Dépense enregistrée', 'success');
      onClose();
    }
  };

  return (
    <Sheet title={existing ? 'Modifier la dépense' : 'Nouvelle dépense'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <AmountField amount={amount} big autoFocus={!existing} />
        <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Catégorie</legend>
          <div className="cat-grid">
            {cats.map((c) => (
              <button type="button" key={c.id} className="cat-btn" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                <span aria-hidden>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          {tried && errors.category && <small className="field-error">Choisis une catégorie.</small>}
        </fieldset>
        <div className="grid-2">
          <Field label="Date" error={tried && errors.date ? 'Date invalide' : undefined}>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Statut">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)}>
              <option value="realisee">Réalisée</option>
              <option value="prevue">Prévue</option>
              <option value="annulee">Annulée</option>
            </select>
          </Field>
        </div>
        <Field label="Description (facultatif)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. Marché du samedi" maxLength={120} />
        </Field>
        {!showMore ? (
          <button type="button" className="link" onClick={() => setShowMore(true)}>
            + Type et note
          </button>
        ) : (
          <>
            <div className="segmented" role="group" aria-label="Type de dépense">
              <button type="button" aria-pressed={nature === 'variable'} onClick={() => setNature('variable')}>
                Variable
              </button>
              <button type="button" aria-pressed={nature === 'fixe'} onClick={() => setNature('fixe')}>
                Fixe
              </button>
            </div>
            <Field label="Note (facultatif)">
              <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </Field>
          </>
        )}
        {status === 'prevue' && <div className="notice notice-info small">Une dépense prévue n’est pas comptée dans les dépenses réalisées tant que tu ne la passes pas en « Réalisée ».</div>}

        <button type="submit" className="btn btn-primary btn-block">
          {existing ? 'Enregistrer les modifications' : 'Ajouter la dépense'}
        </button>
      </form>

      {existing && (
        <div className="stack" style={{ marginTop: 18 }}>
          <div className="card stack">
            <div className="row-between">
              <h3>Remboursements</h3>
              <span className="tiny">Net : {money(netExpense(existing))}</span>
            </div>
            <p className="tiny" style={{ margin: 0 }}>
              Un remboursement réduit cette dépense (il n’est pas compté comme un revenu).
            </p>
            {existing.refunds.map((r) => (
              <div key={r.id} className="row-between small">
                <span>
                  {formatDateShort(r.date)} · <span className="num">{money(r.amount)}</span>
                </span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'refund/delete', expenseId: existing.id, refundId: r.id })}>
                  Retirer
                </button>
              </div>
            ))}
            {refundedAmount(existing) < existing.amount && (
              <div className="grid-2" style={{ alignItems: 'end' }}>
                <AmountField label="Montant remboursé" amount={refundAmt} />
                <Field label="Date">
                  <input type="date" className="input" value={refundDate} onChange={(e) => setRefundDate(e.target.value)} />
                </Field>
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ gridColumn: '1 / -1' }}
                  onClick={() => {
                    refundAmt.setTouched(true);
                    if (!refundAmt.valid || !isValidISO(refundDate)) return;
                    if (dispatch({ type: 'refund/add', expenseId: existing.id, refund: { amount: refundAmt.cents!, date: refundDate } })) {
                      toast('Remboursement enregistré', 'success');
                      onClose();
                    }
                  }}
                >
                  Ajouter le remboursement
                </button>
              </div>
            )}
          </div>
          <div className="grid-2">
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (dispatch({ type: 'expense/add', expense: { ...existing, date: today, status: 'realisee', refunds: [], recurringId: undefined, occurrenceDate: undefined } })) {
                  toast('Dépense dupliquée à la date du jour', 'success');
                  onClose();
                }
              }}
            >
              Dupliquer
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              Supprimer
            </button>
          </div>
        </div>
      )}
      {confirmDelete && existing && (
        <Confirm
          title="Supprimer cette dépense ?"
          message={`${money(existing.amount)} du ${formatDateShort(existing.date)}. Elle sera retirée de l’historique et des statistiques. Astuce : le statut « Annulée » garde une trace sans la compter.`}
          danger
          confirmLabel="Supprimer"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: 'expense/delete', id: existing.id });
            toast('Dépense supprimée');
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

/* ======================= Revenu ======================= */

export function IncomeForm({ existing, onClose }: { existing?: Income; onClose: () => void }) {
  const { dispatch, today, toast, money } = useStore();
  const amount = useAmount(existing?.amount);
  const [type, setType] = useState<IncomeType>(existing?.type ?? 'salaire');
  const [date, setDate] = useState(existing?.date ?? today);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [status, setStatus] = useState<IncomeStatus>(existing?.status ?? 'recu');
  const [note, setNote] = useState(existing?.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    amount.setTouched(true);
    if (!amount.valid || !isValidISO(date)) return;
    const fields = { amount: amount.cents!, type, date, description: description.trim() || INCOME_TYPE_LABEL[type], status, note: note.trim() || undefined };
    const ok = existing ? dispatch({ type: 'income/update', income: { ...existing, ...fields } }) : dispatch({ type: 'income/add', income: fields });
    if (ok) {
      toast(existing ? 'Revenu modifié' : 'Revenu enregistré', 'success');
      onClose();
    }
  };

  return (
    <Sheet title={existing ? 'Modifier le revenu' : 'Nouveau revenu'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <AmountField amount={amount} big autoFocus={!existing} />
        <div className="chips" role="group" aria-label="Type de revenu">
          {(Object.keys(INCOME_TYPE_LABEL) as IncomeType[]).map((t) => (
            <button type="button" key={t} className="chip" aria-pressed={type === t} onClick={() => setType(t)}>
              {INCOME_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="grid-2">
          <Field label="Date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Statut">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as IncomeStatus)}>
              <option value="recu">Reçu</option>
              <option value="prevu">Prévu</option>
              <option value="annule">Annulé</option>
            </select>
          </Field>
        </div>
        <Field label="Description (facultatif)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={INCOME_TYPE_LABEL[type]} maxLength={120} />
        </Field>
        <Field label="Note (facultatif)">
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        {type === 'remboursement' && (
          <div className="notice notice-info small">Pour un remboursement lié à une dépense précise (ex. mutuelle), ouvre plutôt la dépense et ajoute-le dedans : il ne sera pas compté deux fois.</div>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {existing ? 'Enregistrer' : 'Ajouter le revenu'}
        </button>
        {existing && (
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmDelete(true)}>
            Supprimer
          </button>
        )}
      </form>
      {confirmDelete && existing && (
        <Confirm
          title="Supprimer ce revenu ?"
          message={`${money(existing.amount)} du ${formatDateShort(existing.date)} sera retiré de l’historique.`}
          danger
          confirmLabel="Supprimer"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: 'income/delete', id: existing.id });
            toast('Revenu supprimé');
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

/* ======================= Récurrence ======================= */

export function RecurringForm({ existing, kind: kindProp, onClose }: { existing?: RecurringTransaction; kind?: 'income' | 'expense'; onClose: () => void }) {
  const { data, dispatch, today, toast } = useStore();
  const [kind, setKind] = useState<'income' | 'expense'>(existing?.kind ?? kindProp ?? 'expense');
  const amount = useAmount(existing?.amount);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'logement');
  const [incomeType, setIncomeType] = useState<IncomeType>(existing?.incomeType ?? 'salaire');
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'mensuel');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [nature, setNature] = useState<Nature>(existing?.nature ?? 'fixe');
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const endErr = endDate && (!isValidISO(endDate) || endDate < startDate);
  const descErr = !description.trim();

  const save = () => {
    setTried(true);
    amount.setTouched(true);
    if (!amount.valid || !isValidISO(startDate) || endErr || descErr) return;
    const fields = {
      kind,
      amount: amount.cents!,
      description: description.trim(),
      categoryId: kind === 'expense' ? categoryId : undefined,
      incomeType: kind === 'income' ? incomeType : undefined,
      nature: kind === 'expense' ? nature : ('fixe' as Nature),
      frequency,
      startDate,
      endDate: endDate || undefined,
      active
    };
    const ok = existing
      ? dispatch({ type: 'recurring/update', recurring: { ...existing, ...fields } })
      : dispatch({ type: 'recurring/add', recurring: { ...fields, skipped: [] } });
    if (ok) {
      toast(existing ? 'Récurrence modifiée' : 'Récurrence programmée', 'success');
      onClose();
    }
  };

  return (
    <Sheet title={existing ? 'Modifier la récurrence' : kind === 'income' ? 'Revenu récurrent' : 'Charge récurrente'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {!existing && (
          <div className="segmented" role="group" aria-label="Type">
            <button type="button" aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>
              Dépense
            </button>
            <button type="button" aria-pressed={kind === 'income'} onClick={() => setKind('income')}>
              Revenu
            </button>
          </div>
        )}
        <AmountField amount={amount} big />
        <Field label="Nom" error={tried && descErr ? 'Donne un nom, ex. Loyer' : undefined}>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === 'income' ? 'Ex. Salaire' : 'Ex. Loyer, Netflix…'} maxLength={80} />
        </Field>
        {kind === 'expense' ? (
          <div className="grid-2">
            <Field label="Catégorie">
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {data.categories
                  .filter((c) => !c.archived || c.id === categoryId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Type">
              <select className="input" value={nature} onChange={(e) => setNature(e.target.value as Nature)}>
                <option value="fixe">Fixe</option>
                <option value="variable">Variable</option>
              </select>
            </Field>
          </div>
        ) : (
          <Field label="Type de revenu">
            <select className="input" value={incomeType} onChange={(e) => setIncomeType(e.target.value as IncomeType)}>
              {(Object.keys(INCOME_TYPE_LABEL) as IncomeType[]).map((t) => (
                <option key={t} value={t}>
                  {INCOME_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Fréquence">
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {Object.entries(FREQUENCY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="Première échéance" hint="Le jour sert pour les suivantes">
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Fin (facultatif)" error={tried && endErr ? 'Après le début' : undefined}>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <Switch label="Active" checked={active} onChange={setActive} />
        <div className="notice notice-info small">Les échéances apparaissent comme « prévues ». Elles ne comptent comme payées ou reçues que lorsque tu les confirmes.</div>
        <button type="submit" className="btn btn-primary btn-block">
          {existing ? 'Enregistrer' : 'Programmer'}
        </button>
        {existing && (
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmDelete(true)}>
            Supprimer la récurrence
          </button>
        )}
      </form>
      {confirmDelete && existing && (
        <Confirm
          title="Supprimer la récurrence ?"
          message="Les échéances futures disparaîtront. Les opérations déjà confirmées restent dans ton historique. Tu peux aussi simplement la suspendre."
          danger
          confirmLabel="Supprimer"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: 'recurring/delete', id: existing.id });
            toast('Récurrence supprimée');
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

/* ======================= Confirmer une échéance ======================= */

export function ConfirmOccurrenceForm({ rec, occurrenceDate, onClose }: { rec: RecurringTransaction; occurrenceDate: string; onClose: () => void }) {
  const { dispatch, toast, today } = useStore();
  const amount = useAmount(rec.amount);
  const [date, setDate] = useState(occurrenceDate <= today ? occurrenceDate : today);
  return (
    <Sheet title={rec.kind === 'income' ? 'Confirmer la réception' : 'Confirmer le paiement'} onClose={onClose}>
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>
          {rec.description} — échéance du {formatDateShort(occurrenceDate)}. Ajuste le montant s’il a changé ce mois-ci : la récurrence ne sera pas modifiée.
        </p>
        <AmountField amount={amount} big />
        <Field label={rec.kind === 'income' ? 'Date de réception' : 'Date du paiement'}>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            amount.setTouched(true);
            if (!amount.valid || !isValidISO(date)) return;
            if (dispatch({ type: 'recurring/confirm', recurringId: rec.id, occurrenceDate, date, amount: amount.cents! })) {
              toast(rec.kind === 'income' ? 'Revenu confirmé' : 'Paiement confirmé', 'success');
              onClose();
            }
          }}
        >
          Confirmer
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            dispatch({ type: 'recurring/skip', recurringId: rec.id, occurrenceDate });
            toast('Échéance ignorée pour cette fois');
            onClose();
          }}
        >
          Ignorer cette échéance
        </button>
      </div>
    </Sheet>
  );
}

/* ======================= Objectif d'épargne ======================= */

export function GoalForm({ existing, onClose }: { existing?: SavingsGoal; onClose: () => void }) {
  const { data, dispatch, toast } = useStore();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '⭐');
  const target = useAmount(existing?.target);
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? '');
  const [paused, setPaused] = useState(existing?.paused ?? false);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasHistory = existing && data.movements.some((m) => m.goalId === existing.id || m.toGoalId === existing.id);

  const save = () => {
    setTried(true);
    target.setTouched(true);
    if (!name.trim() || !target.valid || (targetDate && !isValidISO(targetDate))) return;
    const fields = { name: name.trim(), icon, target: target.cents!, targetDate: targetDate || undefined, paused };
    const ok = existing ? dispatch({ type: 'goal/update', goal: { ...existing, ...fields } }) : dispatch({ type: 'goal/add', goal: fields });
    if (ok) {
      toast(existing ? 'Objectif modifié' : 'Nouveau trésor à remplir !', 'success');
      onClose();
    }
  };

  return (
    <Sheet title={existing ? 'Modifier l’objectif' : 'Nouvel objectif'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {!existing && (
          <div className="chips" role="group" aria-label="Modèles">
            {GOAL_TEMPLATES.map((t) => (
              <button
                type="button"
                key={t.name}
                className="chip"
                aria-pressed={name === t.name}
                onClick={() => {
                  setName(t.name === 'Objectif libre' ? '' : t.name);
                  setIcon(t.icon);
                }}
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>
        )}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Icône">
            <input className="input center" style={{ width: 64, fontSize: 24 }} value={icon} onChange={(e) => setIcon([...e.target.value].slice(-2).join('') || '⭐')} aria-label="Icône (émoji)" />
          </Field>
          <div className="grow">
            <Field label="Nom" error={tried && !name.trim() ? 'Donne un nom à ton objectif' : undefined}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
          </div>
        </div>
        <AmountField label="Montant cible" amount={target} big />
        <Field label="Date cible (facultatif)">
          <input type="date" className="input" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        {existing && <Switch label="Mettre en pause" checked={paused} onChange={setPaused} />}
        <button type="submit" className="btn btn-primary btn-block">
          {existing ? 'Enregistrer' : 'Créer l’objectif'}
        </button>
        {existing && !hasHistory && (
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmDelete(true)}>
            Supprimer
          </button>
        )}
        {existing && hasHistory && <p className="tiny center">Cet objectif a un historique : il peut être mis en pause mais pas supprimé, pour garder la trace des mouvements.</p>}
      </form>
      {confirmDelete && existing && (
        <Confirm
          title="Supprimer cet objectif ?"
          message="Il n’a aucun mouvement enregistré."
          danger
          confirmLabel="Supprimer"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            if (dispatch({ type: 'goal/delete', id: existing.id })) {
              toast('Objectif supprimé');
              window.location.hash = '/tresors';
              onClose();
            }
          }}
        />
      )}
    </Sheet>
  );
}

/* ======================= Mouvement d'épargne ======================= */

export function MovementForm({ goalId: initialGoal, type: initialType = 'versement', onClose }: { goalId?: string; type?: MovementType; onClose: () => void }) {
  const { data, dispatch, today, toast, money } = useStore();
  const goals = data.goals;
  const [goalId, setGoalId] = useState(initialGoal ?? goals.find((g) => !g.paused)?.id ?? goals[0]?.id ?? '');
  const [type, setType] = useState<MovementType>(initialType);
  const [toGoalId, setToGoalId] = useState(goals.find((g) => g.id !== goalId)?.id ?? '');
  const amount = useAmount();
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const balance = goalId ? goalBalance(goalId, data.movements) : 0;

  if (!goals.length) {
    return (
      <Sheet title="Mettre de côté" onClose={onClose}>
        <div className="stack center">
          <p className="muted">Crée d’abord un objectif d’épargne pour y verser de l’argent.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onClose();
              window.location.hash = '/tresors/nouveau';
            }}
          >
            Créer un objectif
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Mouvement d’épargne" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          amount.setTouched(true);
          if (!amount.valid || !isValidISO(date)) return;
          const ok = dispatch({
            type: 'movement/add',
            movement: { goalId, type, amount: amount.cents!, date, toGoalId: type === 'transfert' ? toGoalId : undefined, note: note.trim() || undefined }
          });
          if (ok) {
            toast(type === 'versement' ? 'Versement enregistré' : type === 'retrait' ? 'Retrait enregistré' : 'Transfert effectué', 'success');
            onClose();
          }
        }}
      >
        <div className="segmented" role="group" aria-label="Type de mouvement">
          <button type="button" aria-pressed={type === 'versement'} onClick={() => setType('versement')}>
            Verser
          </button>
          <button type="button" aria-pressed={type === 'retrait'} onClick={() => setType('retrait')}>
            Retirer
          </button>
          {goals.length > 1 && (
            <button type="button" aria-pressed={type === 'transfert'} onClick={() => setType('transfert')}>
              Transférer
            </button>
          )}
        </div>
        <Field label={type === 'transfert' ? 'Depuis' : 'Objectif'} hint={`Solde actuel : ${money(balance)}`}>
          <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon} {g.name}
                {g.paused ? ' (en pause)' : ''}
              </option>
            ))}
          </select>
        </Field>
        {type === 'transfert' && (
          <Field label="Vers">
            <select className="input" value={toGoalId} onChange={(e) => setToGoalId(e.target.value)}>
              {goals
                .filter((g) => g.id !== goalId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {g.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <AmountField amount={amount} big />
        <Field label="Date">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (facultatif)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
        </Field>
        <div className="notice notice-info small">
          {type === 'versement' && 'Un versement est un transfert interne : il réduit ton disponible estimé, mais ce n’est pas une dépense.'}
          {type === 'retrait' && 'Un retrait remet l’argent dans ton disponible estimé, sans être compté comme un revenu.'}
          {type === 'transfert' && 'Un transfert entre objectifs ne change ni ton disponible, ni ton épargne totale.'}
        </div>
        <button type="submit" className="btn btn-primary btn-block">
          Valider
        </button>
      </form>
    </Sheet>
  );
}

/* ======================= Catégorie ======================= */

export function CategoryForm({ onClose }: { onClose: () => void }) {
  const { dispatch, toast } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  return (
    <Sheet title="Nouvelle catégorie" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (dispatch({ type: 'category/add', category: { name, icon } })) {
            toast('Catégorie créée', 'success');
            onClose();
          }
        }}
      >
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Icône">
            <input className="input center" style={{ width: 64, fontSize: 24 }} value={icon} onChange={(e) => setIcon([...e.target.value].slice(-2).join('') || '🏷️')} />
          </Field>
          <div className="grow">
            <Field label="Nom">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
            </Field>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block">
          Créer
        </button>
      </form>
    </Sheet>
  );
}
