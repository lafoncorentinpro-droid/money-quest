import { useEffect, useState } from 'react';
import { formatDateLong, formatDateShort, parsePeriod, periodOf } from '../domain/dates';
import { goalBalance, monthlyNeeded, totalSavings } from '../domain/finance';
import { percent } from '../domain/money';
import type { SavingsMovement } from '../domain/types';
import { useStore } from '../store/store';
import { Confirm, Empty, PageHead, Progress } from '../ui/components';
import { Fox } from '../ui/Fox';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';
import { Icon } from '../ui/Icon';

export function Treasures({ id }: { id?: string }) {
  const open = useSheets();
  useEffect(() => {
    if (id === 'nouveau') {
      open({ kind: 'goal' });
      go('tresors');
    }
  }, [id, open]);
  if (id && id !== 'nouveau') return <GoalDetail id={id} />;
  return <GoalList />;
}

function monthsLeft(today: string, date?: string): number {
  if (!date || date <= today) return 0;
  const a = parsePeriod(periodOf(today));
  const b = parsePeriod(periodOf(date));
  return Math.max(1, (b.y - a.y) * 12 + (b.m - a.m));
}

function GoalList() {
  const { data, money, today } = useStore();
  const open = useSheets();
  const total = totalSavings(data);
  return (
    <div className="page">
      <PageHead title="Mes Trésors" />
      <section className="card card-accent row">
        <Fox mood={data.goals.length ? 'fier' : 'exploration'} size={70} equipped={data.progress.equipped} animate={data.settings.animations} />
        <div className="grow">
          <div className="small muted">Épargne totale suivie</div>
          <div className="hero-amount num" style={{ fontSize: 30 }}>
            {money(total)}
          </div>
          <div className="tiny">Somme des soldes de tes objectifs (suivis dans l’app, pas un relevé bancaire).</div>
        </div>
      </section>
      <div className="grid-2">
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'goal' })}>
          + Objectif
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'movement' })} disabled={!data.goals.length}>
          🧰 Verser
        </button>
      </div>
      {data.goals.length === 0 ? (
        <section className="card">
          <Empty icon="🗺️" title="Aucun trésor pour l’instant">
            <span className="small">Vacances, fonds d’urgence, projet… Crée un objectif et remplis-le à ton rythme, même par petites sommes.</span>
          </Empty>
        </section>
      ) : (
        data.goals.map((g) => {
          const bal = goalBalance(g.id, data.movements);
          const reached = g.target > 0 && bal >= g.target;
          const left = monthsLeft(today, g.targetDate);
          return (
            <button key={g.id} type="button" className="card stack" style={{ textAlign: 'left', width: '100%' }} onClick={() => go(`tresors/${g.id}`)}>
              <div className="row">
                <span className="icon-bubble" style={{ width: 48, height: 48, fontSize: 26 }} aria-hidden>
                  {g.icon}
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row-between">
                    <strong className="ellipsis">{g.name}</strong>
                    {reached ? <span className="tag tag-ok">🏆 Atteint</span> : g.paused ? <span className="tag">⏸ En pause</span> : <span className="tag">En cours</span>}
                  </div>
                  <div className="small num muted">
                    {g.target > 0 ? `${money(bal)} sur ${money(g.target)} · ${percent(bal, g.target)} %` : `${money(bal)} · sans montant cible`}
                  </div>
                </div>
              </div>
              {g.target > 0 && <Progress value={bal} max={g.target} tone={reached ? 'ok' : undefined} label={`Progression ${g.name}`} />}
              {g.targetDate && !reached && (
                <div className="tiny">
                  Objectif : {formatDateShort(g.targetDate)} — environ {money(monthlyNeeded(bal, g.target, left))} / mois (estimation)
                </div>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}

function GoalDetail({ id }: { id: string }) {
  const { data, money, dispatch, toast } = useStore();
  const open = useSheets();
  const [toDelete, setToDelete] = useState<SavingsMovement | null>(null);
  const g = data.goals.find((x) => x.id === id);
  if (!g) {
    return (
      <div className="page">
        <PageHead title="Objectif" backTo="tresors" />
        <Empty title="Objectif introuvable" />
      </div>
    );
  }
  const bal = goalBalance(g.id, data.movements);
  const reached = g.target > 0 && bal >= g.target;
  const history = data.movements.filter((m) => m.goalId === g.id || m.toGoalId === g.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const name = (gid?: string) => data.goals.find((x) => x.id === gid)?.name ?? '?';

  return (
    <div className="page">
      <PageHead
        title={g.name}
        backTo="tresors"
        right={
          <button type="button" className="btn btn-sm" onClick={() => open({ kind: 'goal', id: g.id })}>
            Modifier
          </button>
        }
      />
      <section className="card stack center">
        <div style={{ fontSize: 54 }} aria-hidden>
          {g.icon}
        </div>
        <div className="hero-amount num">{money(bal)}</div>
        <div className="muted num">
          {g.target > 0 ? `sur ${money(g.target)} · ${percent(bal, g.target)} %` : "sans montant cible : tu peux en fixer un via « Modifier »"}
        </div>
        {g.target > 0 && <Progress value={bal} max={g.target} tone={reached ? 'ok' : undefined} label="Progression" />}
        {reached ? (
          <div className="notice notice-success" style={{ justifyContent: 'center' }}>
            🏆 Trésor rempli{g.reachedAt ? ` le ${formatDateShort(g.reachedAt)}` : ''} ! Bravo.
          </div>
        ) : (
          g.target > 0 && <div className="small muted">Il reste {money(g.target - bal)}</div>
        )}
        {g.paused && <span className="tag">⏸ En pause</span>}
        {g.targetDate && <div className="tiny">Date cible : {formatDateLong(g.targetDate)}</div>}
      </section>
      <div className="grid-3">
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'movement', goalId: g.id, type: 'versement' })}>
          Verser
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'movement', goalId: g.id, type: 'retrait' })} disabled={bal <= 0}>
          Retirer
        </button>
        <button type="button" className="btn" onClick={() => open({ kind: 'movement', goalId: g.id, type: 'transfert' })} disabled={bal <= 0 || data.goals.length < 2}>
          Transférer
        </button>
      </div>
      <section className="card">
        <div className="card-head">
          <h2>Historique</h2>
        </div>
        {history.length === 0 ? (
          <p className="small muted">Aucun mouvement pour l’instant.</p>
        ) : (
          <div className="list">
            {history.map((m) => {
              const incoming = m.type === 'versement' || (m.type === 'transfert' && m.toGoalId === g.id);
              const label =
                m.type === 'versement' ? 'Versement' : m.type === 'retrait' ? 'Retrait' : m.toGoalId === g.id ? `Transfert depuis ${name(m.goalId)}` : `Transfert vers ${name(m.toGoalId)}`;
              return (
                <div key={m.id} className="list-row">
                  <span className="icon-bubble" aria-hidden>
                    {incoming ? '⬆️' : '⬇️'}
                  </span>
                  <div className="grow">
                    <div>{label}</div>
                    <div className="tiny">
                      {formatDateLong(m.date)}
                      {m.note ? ` · ${m.note}` : ''}
                    </div>
                  </div>
                  <span className={`num ${incoming ? 'pos' : ''}`}>
                    {incoming ? '+' : '−'}
                    {money(m.amount)}
                  </span>
                  <button type="button" className="btn btn-sm btn-ghost" aria-label="Supprimer ce mouvement" onClick={() => setToDelete(m)}>
                    <Icon name="xmark" size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {toDelete && (
        <Confirm
          title="Supprimer ce mouvement ?"
          message={`${money(toDelete.amount)} du ${formatDateShort(toDelete.date)}. Le solde de l’objectif et le disponible du mois seront recalculés.`}
          danger
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            if (dispatch({ type: 'movement/delete', id: toDelete.id })) toast('Mouvement supprimé');
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}
