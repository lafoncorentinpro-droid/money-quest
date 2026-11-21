import { useState } from 'react';
import { formatDateShort, periodLabel, periodRange, inRange } from '../domain/dates';
import { monthView } from '../domain/envelopes';
import type { EnvelopeTx, PeriodKey } from '../domain/types';
import { useEnvName } from '../forms/envForms';
import { useStore } from '../store/store';
import { Confirm } from '../ui/components';
import { Icon } from '../ui/Icon';
import { go } from '../ui/router';

const KIND: Record<EnvelopeTx['kind'], string> = { depense: 'Dépense', ajout: 'Ajout', transfert: 'Transfert', correction: 'Correction', seance: 'Séance payée' };

/** Historique : les mois créés et tous les mouvements (dépenses, ajouts, transferts). */
export function EnvHistory() {
  const { data, month, setMonth, money, dispatch, toast } = useStore();
  const name = useEnvName();
  const env = data.envelopes;
  const months = (Object.keys(env.months) as PeriodKey[]).sort().reverse();
  const r = periodRange(month, 1);
  const tx = env.tx.filter((t) => inRange(t.date, r) || [t.from, t.to].some((k) => k?.startsWith(month + ':'))).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const [del, setDel] = useState<EnvelopeTx | null>(null);

  return (
    <div className="page">
      <header className="home-head">
        <div>
          <div className="home-month">Mes mois</div>
          <h1 className="page-title">Historique</h1>
        </div>
      </header>

      {months.length === 0 ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>Aucun mois créé pour l’instant. Crée ton premier mois depuis l’accueil.</p>
        </section>
      ) : (
        <section className="card list">
          {months.map((p) => {
            const v = monthView(env, p)!;
            return (
              <button
                key={p}
                type="button"
                className={`list-row op-row hist-month ${p === month ? 'is-sel' : ''}`}
                onClick={() => {
                  setMonth(p);
                  go('accueil');
                }}
              >
                <span className="grow">
                  <span className="op-title" style={{ textTransform: 'capitalize' }}>
                    {periodLabel(p, 1)}
                  </span>
                  <span className="op-sub">Salaire {money(v.plan.salary)} · fixes {money(v.plan.fixed)}</span>
                </span>
                <span className="op-amount num">{money(v.available)}</span>
                <Icon name="chevron-right" size={18} />
              </button>
            );
          })}
        </section>
      )}

      <h2 className="section-title" style={{ textTransform: 'none' }}>
        Mouvements · {periodLabel(month, 1)}
      </h2>
      <section className="card list">
        {tx.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Aucun mouvement ce mois-ci.</p>
        ) : (
          tx.map((t) => (
            <div key={t.id} className="list-row op-row">
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="op-title">
                  <span className="ellipsis">{t.kind === 'transfert' ? `${name(t.from!)} → ${name(t.to!)}` : name((t.from ?? t.to)!)}</span>
                </span>
                <span className="op-sub ellipsis">
                  {formatDateShort(t.date)} · {KIND[t.kind]}
                  {t.note ? ` · ${t.note}` : ''}
                </span>
              </span>
              <span className={`op-amount num ${t.to && !t.from ? 'pos' : ''}`}>
                {t.kind === 'transfert' ? '⇄ ' : t.from ? '− ' : '+ '}
                {money(t.amount)}
              </span>
              <button type="button" className="icon-x" aria-label="Annuler ce mouvement" onClick={() => setDel(t)}>
                <Icon name="xmark" size={16} />
              </button>
            </div>
          ))
        )}
      </section>

      {del && (
        <Confirm
          title="Annuler ce mouvement ?"
          message={`${KIND[del.kind]} de ${money(del.amount)} du ${formatDateShort(del.date)}. Les soldes seront recalculés.`}
          danger
          confirmLabel="Annuler le mouvement"
          onCancel={() => setDel(null)}
          onConfirm={() => {
            dispatch({ type: 'env/tx/delete', id: del.id });
            toast('Mouvement annulé');
            setDel(null);
          }}
        />
      )}
    </div>
  );
}
