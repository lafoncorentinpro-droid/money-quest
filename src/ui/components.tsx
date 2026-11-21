import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { periodLabel, shiftPeriod } from '../domain/dates';
import { centsToInput, parseAmount, percent } from '../domain/money';
import type { PeriodKey } from '../domain/types';
import { back } from './router';
import { Icon } from './Icon';

/* ---------- Feuille modale accessible ---------- */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]), select, textarea');
    if (first && window.matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
    else ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="xmark" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Confirmation ---------- */
export function Confirm({
  title,
  message,
  confirmLabel = 'Confirmer',
  danger,
  onConfirm,
  onCancel,
  requireText
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  requireText?: string;
}) {
  const [typed, setTyped] = useState('');
  const ok = !requireText || typed.trim().toUpperCase() === requireText;
  return (
    <Sheet title={title} onClose={onCancel}>
      <div className="stack">
        <div className="muted">{message}</div>
        {requireText && (
          <label className="field">
            <span>Tape « {requireText} » pour confirmer</span>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
          </label>
        )}
        <div className="grid-2">
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={!ok} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Champs ---------- */
export function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error && <small className="tiny">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

/** Champ montant : garde le texte saisi, renvoie des centimes ou null. */
export function useAmount(initial?: number) {
  const [text, setText] = useState(initial !== undefined ? centsToInput(initial) : '');
  const [touched, setTouched] = useState(false);
  const cents = parseAmount(text);
  return { text, setText, cents, touched, setTouched, valid: cents !== null && cents > 0 };
}

export function AmountField({
  label = 'Montant',
  amount,
  big,
  autoFocus,
  allowZero
}: {
  label?: string;
  amount: ReturnType<typeof useAmount>;
  big?: boolean;
  autoFocus?: boolean;
  allowZero?: boolean;
}) {
  const invalid = amount.touched && (amount.cents === null || (!allowZero && amount.cents === 0));
  return (
    <Field label={label} error={invalid ? 'Saisis un montant valide, par ex. 12,50' : undefined}>
      <input
        className={`input ${big ? 'amount-input' : ''}`}
        inputMode="decimal"
        placeholder="0,00 €"
        value={amount.text}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        onChange={(e) => amount.setText(e.target.value)}
        onBlur={() => amount.setTouched(true)}
      />
    </Field>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="row-between" style={{ minHeight: 48 }}>
      <span>{label}</span>
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span />
      </span>
    </label>
  );
}

/* ---------- Affichage ---------- */
export function Progress({ value, max, tone, label }: { value: number; max: number; tone?: string; label: string }) {
  const p = percent(value, max);
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={label}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}

export function PageHead({ title, backTo, right }: { title: string; backTo?: string; right?: ReactNode }) {
  return (
    <header className="page-head">
      {backTo !== undefined && (
        <button type="button" className="back-btn" onClick={() => back(backTo)}>
          <Icon name="chevron-left" size={24} strokeWidth={2.3} />
          Retour
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </header>
  );
}

export function PeriodSwitcher({ period, onChange, startDay, max }: { period: PeriodKey; onChange: (p: PeriodKey) => void; startDay: number; max?: PeriodKey }) {
  return (
    <div className="row-between card card-tight">
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(shiftPeriod(period, -1))} aria-label="Mois précédent">
        <Icon name="chevron-left" />
      </button>
      <strong style={{ textTransform: 'capitalize', textAlign: 'center' }}>{periodLabel(period, startDay)}</strong>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => onChange(shiftPeriod(period, 1))}
        aria-label="Mois suivant"
        disabled={!!max && period >= max}
      >
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div style={{ fontSize: 34 }}>{icon}</div>}
      <strong style={{ color: 'var(--text)' }}>{title}</strong>
      {children}
    </div>
  );
}

export function StateTag({ state }: { state: 'ok' | 'proche' | 'depasse' }) {
  if (state === 'depasse') return <span className="tag tag-warn">▲ Dépassé</span>;
  if (state === 'proche') return <span className="tag tag-gold">● Proche</span>;
  return <span className="tag tag-ok">✓ OK</span>;
}
