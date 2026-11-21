import { formatDateShort } from '../domain/dates';
import { FREQUENCY_LABEL, nextDue } from '../domain/recurring';
import { useStore } from '../store/store';
import { useSheets } from '../ui/sheets';

/** Liste « Mes dépenses récurrentes » : ajoutées à la main, confirmées à chaque échéance. */
export function RecurringExpensesCard() {
  const { data, today, money } = useStore();
  const open = useSheets();
  const catName = (id: string) => data.categories.find((c) => c.id === id);
  const list = data.recurring.filter((r) => r.kind === 'expense').sort((a, b) => Number(b.active) - Number(a.active) || a.description.localeCompare(b.description));
  return (
    <section className="card" aria-labelledby="recdep">
      <div className="card-head">
        <h2 id="recdep">Mes dépenses récurrentes</h2>
        <button type="button" className="link" onClick={() => open({ kind: 'recurring', recKind: 'expense' })}>
          + Ajouter
        </button>
      </div>
      {list.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          Aucune pour l’instant : loyer, abonnements, forfait…
        </p>
      ) : (
        <div className="list">
          {list.map((r) => {
            const next = nextDue(data, r, today);
            return (
              <button key={r.id} type="button" className="list-row" onClick={() => open({ kind: 'recurring', id: r.id })} style={{ opacity: r.active ? 1 : 0.6 }}>
                <span className="icon-bubble" aria-hidden>
                  {catName(r.categoryId ?? '')?.icon ?? '🔁'}
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis">{r.description || catName(r.categoryId ?? '')?.name || 'Dépense récurrente'}</div>
                  <div className="tiny ellipsis">
                    {FREQUENCY_LABEL[r.frequency] ?? r.frequency}
                    {r.active ? (next ? ` · prochaine le ${formatDateShort(next)}` : ' · terminée') : ' · en pause'}
                  </div>
                </div>
                <span className="num" style={{ fontWeight: 600 }}>
                  −{money(r.amount)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
