import { useState } from 'react';
import { formatDateShort, periodLabel, shiftPeriod } from '../domain/dates';
import {
  balance,
  diversCarryOver,
  diversKey,
  envelopeChoices,
  envelopeLabel,
  EPARGNE,
  fixedTotal,
  isProject,
  projectView,
  monthPlan,
  nextMonthDefaults,
  weekKey,
  weekOfDate,
  WEEKS
} from '../domain/envelopes';
import { centsToInput, parseAmount } from '../domain/money';
import type { EnvelopeKey, PeriodKey } from '../domain/types';
import { useStore } from '../store/store';
import { AmountField, Field, Sheet, Switch, useAmount } from '../ui/components';
import { Icon } from '../ui/Icon';

const monthShort = (p: string) => periodLabel(p as PeriodKey, 1).split(' ')[0].slice(0, 4) + '.';

/** Libellé d'enveloppe, avec le mois si ce n'est pas le mois affiché. */
export function useEnvName() {
  const { month, data } = useStore();
  return (key: EnvelopeKey) => {
    const p = key.includes(':') ? key.split(':')[0] : null;
    return p && p !== month ? `${envelopeLabel(key, data.envelopes)} (${monthShort(p)})` : envelopeLabel(key, data.envelopes);
  };
}

/* ======================= Créer / modifier un mois ======================= */

interface Row {
  id: string;
  name: string;
  text: string;
}

export function EnvMonthForm({ period, onClose }: { period: PeriodKey; onClose: () => void }) {
  const { data, dispatch, toast, money, today } = useStore();
  const existing = data.envelopes.months[period];
  const init = existing ?? nextMonthDefaults(data.envelopes, period);
  const salary = useAmount(init.salary || undefined);
  const savings = useAmount(init.savings);
  const weekly = useAmount(init.weekly);
  const [rows, setRows] = useState<Row[]>(init.fixed.map((f) => ({ id: f.id, name: f.name, text: centsToInput(f.amount) })));
  const fixed = rows.map((r) => ({ id: r.id, name: r.name, amount: parseAmount(r.text) ?? 0 }));
  const plan = monthPlan({ salary: salary.cents ?? 0, fixed, savings: savings.cents ?? 0, weekly: weekly.cents ?? 0 });
  const setRow = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  // Report des achats divers restants du mois précédent (seulement à la création du mois).
  const carry = existing ? 0 : diversCarryOver(data.envelopes, period);
  const prevName = periodLabel(shiftPeriod(period, -1), 1).split(' ')[0];
  const [withCarry, setWithCarry] = useState(true);
  const carried = carry > 0 && withCarry ? carry : 0;

  const save = () => {
    salary.setTouched(true);
    if (salary.cents === null || savings.cents === null || weekly.cents === null) return;
    if (rows.some((r) => parseAmount(r.text) === null)) return toast('Un montant de dépense fixe est invalide.', 'error');
    if (dispatch({ type: 'env/month/save', month: { period, salary: salary.cents, fixed, savings: savings.cents, weekly: weekly.cents } })) {
      if (carried > 0) {
        dispatch({ type: 'env/tx/add', tx: { date: today, kind: 'transfert', from: diversKey(shiftPeriod(period, -1)), to: diversKey(period), amount: carried, note: `Reste de ${prevName}` } });
      }
      toast(existing ? 'Mois mis à jour' : carried > 0 ? `Mois créé, avec ${money(carried)} de ${prevName}` : 'Mois créé', 'success');
      onClose();
    }
  };

  return (
    <Sheet title={existing ? 'Modifier le mois' : 'Créer le mois'} subtitle={`${periodLabel(period, 1)} · tes paramètres sont repris du mois précédent.`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <AmountField label="Salaire net du mois" amount={salary} big autoFocus={!existing} />

        <div className="field">
          <span>Dépenses fixes</span>
          <div className="fixed-list">
            {rows.map((r) => (
              <div key={r.id} className="fixed-row">
                <input className="input" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} aria-label="Nom de la dépense fixe" maxLength={40} />
                <input className="input fixed-amount" inputMode="decimal" value={r.text} onChange={(e) => setRow(r.id, { text: e.target.value })} aria-label={`Montant ${r.name}`} />
                <button type="button" className="icon-x" aria-label={`Retirer ${r.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                  <Icon name="xmark" size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="more-link" onClick={() => setRows((rs) => [...rs, { id: `fixe-${Date.now()}`, name: '', text: '' }])}>
            <Icon name="plus" size={18} strokeWidth={2.2} /> Ajouter une dépense fixe
          </button>
          <div className="row-between total-line">
            <span>Total des dépenses fixes</span>
            <strong className="num">{money(fixedTotal({ fixed }))}</strong>
          </div>
        </div>

        <div className="grid-2">
          <AmountField label="Épargne du mois" amount={savings} allowZero />
          <AmountField label="Budget par semaine" amount={weekly} allowZero />
        </div>

        <div className="plan-recap">
          <div className="row-between">
            <span>Salaire</span>
            <span className="num">{money(plan.salary)}</span>
          </div>
          <div className="row-between">
            <span>− Dépenses fixes</span>
            <span className="num">{money(plan.fixed)}</span>
          </div>
          <div className="row-between">
            <span>− Épargne</span>
            <span className="num">{money(plan.savings)}</span>
          </div>
          <div className="row-between">
            <span>− {WEEKS} semaines</span>
            <span className="num">{money(plan.weeks)}</span>
          </div>
          {carried > 0 && (
            <div className="row-between">
              <span>+ Reste de {prevName}</span>
              <span className="num pos">{money(carried)}</span>
            </div>
          )}
          <div className="row-between plan-total">
            <strong>= Achats divers</strong>
            <strong className={`num ${plan.divers + carried < 0 ? 'neg' : ''}`}>{money(plan.divers + carried)}</strong>
          </div>
        </div>
        {plan.divers < 0 && <div className="notice notice-warn small">Le plan dépasse le salaire : baisse l’épargne ou le budget par semaine.</div>}
        {carry > 0 && (
          <Switch card label={`Ajouter les ${money(carry)} restants de ${prevName}`} desc="Tes achats divers non dépensés passent dans ce nouveau mois." checked={withCarry} onChange={setWithCarry} />
        )}

        <button type="submit" className="btn btn-primary btn-block btn-xl">
          <Icon name="check" size={20} strokeWidth={2.4} /> {existing ? 'Enregistrer' : 'Créer le mois'}
        </button>
      </form>
    </Sheet>
  );
}

/* ======================= Une enveloppe ======================= */

type Mode = 'depense' | 'ajout' | 'correction';

export function EnvForm({ envKey, onClose, onTransfer, onEditProject }: { envKey: EnvelopeKey; onClose: () => void; onTransfer: () => void; onEditProject: () => void }) {
  const { data, dispatch, toast, money, today, month, period } = useStore();
  const name = useEnvName();
  const env = data.envelopes;
  const bal = balance(env, envKey);
  const isProj = isProject(env, envKey);
  const [mode, setMode] = useState<Mode>(envKey === EPARGNE || isProj ? 'ajout' : 'depense');
  const amount = useAmount();
  const [note, setNote] = useState('');
  // Projet : l'argent ajouté est toujours pris sur une semaine ou sur les achats divers du mois affiché.
  const sources: EnvelopeKey[] = env.months[month] ? [...Array.from({ length: WEEKS }, (_, i) => weekKey(month, i + 1)), diversKey(month)] : [];
  const [source, setSource] = useState<EnvelopeKey>(weekKey(month, month === period ? weekOfDate(today) : 1));
  const fromSource = isProj && mode === 'ajout';
  const lv = projectView(env, envKey);
  const paidLabel = envKey === 'laser' ? 'Séance payée' : 'Achat payé';
  const history = env.tx
    .filter((t) => t.from === envKey || t.to === envKey)
    .slice(-8)
    .reverse();

  const save = () => {
    amount.setTouched(true);
    if (amount.cents === null) return;
    let ok: boolean | undefined;
    if (mode === 'correction') {
      const diff = amount.cents - bal;
      if (diff === 0) return onClose();
      ok = dispatch({ type: 'env/tx/add', tx: { date: today, kind: 'correction', ...(diff > 0 ? { to: envKey } : { from: envKey }), amount: Math.abs(diff), note: 'Correction manuelle' } });
    } else if (fromSource) {
      if (amount.cents === 0) return;
      if (!sources.length) return toast('Crée d’abord le mois pour pouvoir y prendre de l’argent.', 'error');
      ok = dispatch({ type: 'env/tx/add', tx: { date: today, kind: 'transfert', from: source, to: envKey, amount: amount.cents, note } });
    } else {
      if (amount.cents === 0) return;
      ok = dispatch({ type: 'env/tx/add', tx: { date: today, kind: mode, ...(mode === 'depense' ? { from: envKey } : { to: envKey }), amount: amount.cents, note } });
    }
    if (ok) {
      toast(
        fromSource ? `${money(amount.cents)} : ${name(source)} → ${name(envKey)}` : mode === 'depense' ? `−${money(amount.cents)} sur ${name(envKey)}` : mode === 'ajout' ? `+${money(amount.cents)} ajoutés` : 'Solde corrigé',
        'success'
      );
      onClose();
    }
  };

  return (
    <Sheet title={name(envKey)} onClose={onClose}>
      <div className="env-balance">
        <span>{isProj ? 'Mis de côté' : 'Il reste'}</span>
        <strong className={`num ${bal < 0 ? 'neg' : ''}`}>{money(bal)}</strong>
        {isProj && (
          <>
            <div className="meter-bar is-budget" style={{ marginTop: 10 }}>
              <span style={{ width: `${lv.pct}%` }} />
            </div>
            <small>
              Objectif {money(lv.target)} · encore {money(lv.remaining)}
            </small>
          </>
        )}
      </div>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="segmented seg-lg" role="group" aria-label="Opération">
          {(
            [
              ['depense', 'Dépense'],
              ['ajout', 'Ajouter'],
              ['correction', 'Corriger']
            ] as [Mode, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>
              {l}
            </button>
          ))}
        </div>
        <AmountField label={mode === 'correction' ? 'Nouveau solde' : mode === 'depense' ? 'Montant dépensé' : 'Montant ajouté'} amount={amount} big autoFocus allowZero={mode === 'correction'} />
        {fromSource && (
          <div className="field">
            <span>Pris sur</span>
            {sources.length ? (
              <div className="env-pick" role="group" aria-label="Pris sur">
                {sources.map((k) => (
                  <button key={k} type="button" className="env-chip" aria-pressed={source === k} onClick={() => setSource(k)}>
                    <span className="ellipsis">{name(k)}</span>
                    <strong className="num">{money(balance(env, k))}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <small className="tiny">Le mois affiché n’est pas encore créé : crée-le pour pouvoir y prendre de l’argent.</small>
            )}
          </div>
        )}
        {mode !== 'correction' && (
          <Field label="Note (facultatif)">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'depense' ? 'Ex. Courses' : 'Ex. Reste de la semaine'} maxLength={60} />
          </Field>
        )}
        <button type="submit" className="btn btn-primary btn-block btn-xl">
          <Icon name="check" size={20} strokeWidth={2.4} /> {mode === 'depense' ? 'Déduire' : mode === 'ajout' ? 'Ajouter' : 'Corriger le solde'}
        </button>
      </form>

      <div className="env-actions">
        <button type="button" className="btn btn-soft" onClick={onTransfer}>
          <Icon name="repeat" size={18} /> Transférer
        </button>
        {isProj && bal > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (dispatch({ type: 'env/tx/add', tx: { date: today, kind: 'seance', from: envKey, amount: bal, note: paidLabel } })) {
                toast(`${paidLabel} : enveloppe remise à zéro`, 'success');
                onClose();
              }
            }}
          >
            <Icon name="check" size={18} /> {paidLabel}
          </button>
        )}
      </div>

      {isProj && (
        <button type="button" className="link" style={{ marginTop: 10 }} onClick={onEditProject}>
          Modifier le projet (nom, objectif {money(lv.target)})
        </button>
      )}

      {history.length > 0 && (
        <div className="env-history">
          <h3>Derniers mouvements</h3>
          {history.map((t) => {
            const out = t.from === envKey;
            const other = out ? t.to : t.from;
            return (
              <div key={t.id} className="row-between env-hist-row">
                <span className="ellipsis">
                  <span className="muted">{formatDateShort(t.date)}</span> · {t.kind === 'transfert' ? (out ? `Vers ${name(other!)}` : `De ${name(other!)}`) : t.note || (t.kind === 'depense' ? 'Dépense' : t.kind === 'ajout' ? 'Ajout' : t.kind === 'seance' ? 'Payé' : 'Correction')}
                </span>
                <span className={`num ${out ? '' : 'pos'}`}>
                  {out ? '−' : '+'}
                  {money(t.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

/* ======================= Transfert ======================= */

export function EnvTransferForm({ from: fromProp, onClose }: { from?: EnvelopeKey; onClose: () => void }) {
  const { data, dispatch, toast, money, today, month } = useStore();
  const name = useEnvName();
  const env = data.envelopes;
  const choices = envelopeChoices(env, month);
  const [from, setFrom] = useState<EnvelopeKey>(fromProp ?? choices[0]);
  const [to, setTo] = useState<EnvelopeKey>(choices.find((c) => c !== (fromProp ?? choices[0]) && isProject(env, c)) ?? choices.find((c) => c !== (fromProp ?? choices[0]))!);
  const fromBal = balance(env, from);
  const amount = useAmount(fromBal > 0 ? fromBal : undefined);

  const save = () => {
    amount.setTouched(true);
    if (!amount.cents) return;
    if (dispatch({ type: 'env/tx/add', tx: { date: today, kind: 'transfert', from, to, amount: amount.cents } })) {
      toast(`${money(amount.cents)} : ${name(from)} → ${name(to)}`, 'success');
      onClose();
    }
  };

  const opt = (k: EnvelopeKey) => (
    <option key={k} value={k}>
      {name(k)} · {money(balance(env, k))}
    </option>
  );

  return (
    <Sheet title="Transférer" subtitle="Déplace de l’argent d’une enveloppe à une autre, sans en créer ni en perdre." onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="De">
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {choices.map(opt)}
          </select>
        </Field>
        <Field label="Vers">
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {choices.filter((k) => k !== from).map(opt)}
          </select>
        </Field>
        <AmountField amount={amount} big />
        {fromBal > 0 && (
          <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={() => amount.setText(centsToInput(fromBal))}>
            Tout le reste ({money(fromBal)})
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-block btn-xl">
          <Icon name="repeat" size={20} strokeWidth={2.2} /> Transférer
        </button>
      </form>
    </Sheet>
  );
}

/* ======================= Dépense rapide (bouton +) ======================= */

export function EnvQuickForm({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const { data, dispatch, toast, money, today, month, period } = useStore();
  const name = useEnvName();
  const env = data.envelopes;
  const exists = !!env.months[month];
  const thisWeek = month === period ? weekOfDate(today) : 1;
  const keys: EnvelopeKey[] = [...Array.from({ length: WEEKS }, (_, i) => weekKey(month, i + 1)), diversKey(month), ...env.projects.map((p) => p.key)];
  const [key, setKey] = useState<EnvelopeKey>(weekKey(month, thisWeek));
  const amount = useAmount();
  const [note, setNote] = useState('');

  if (!exists) {
    return (
      <Sheet title="Dépense" onClose={onClose}>
        <p className="muted">Le mois de {periodLabel(month, 1)} n’est pas encore créé.</p>
        <button type="button" className="btn btn-primary btn-block btn-xl" onClick={onCreate}>
          Créer le mois
        </button>
      </Sheet>
    );
  }

  const save = () => {
    amount.setTouched(true);
    if (!amount.cents) return;
    if (dispatch({ type: 'env/tx/add', tx: { date: today, kind: 'depense', from: key, amount: amount.cents, note } })) {
      toast(`−${money(amount.cents)} sur ${name(key)}`, 'success');
      onClose();
    }
  };

  return (
    <Sheet title="Dépense" subtitle="Montant, enveloppe, c’est tout." onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <AmountField amount={amount} big autoFocus />
        <div className="env-pick" role="group" aria-label="Enveloppe">
          {keys.map((k) => (
            <button key={k} type="button" className="env-chip" aria-pressed={key === k} onClick={() => setKey(k)}>
              <span className="ellipsis">{name(k).replace('Prochaine séance laser', 'Laser')}</span>
              <strong className="num">{money(balance(env, k))}</strong>
            </button>
          ))}
        </div>
        <Field label="Note (facultatif)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. Courses" maxLength={60} />
        </Field>
        <button type="submit" className="btn btn-primary btn-block btn-xl">
          <Icon name="check" size={20} strokeWidth={2.4} /> Déduire
        </button>
      </form>
    </Sheet>
  );
}

/* ======================= Projet (laser, gros achat…) ======================= */

export function EnvProjectForm({ projectKey, onClose }: { projectKey?: EnvelopeKey; onClose: () => void }) {
  const { data, dispatch, toast, money } = useStore();
  const existing = data.envelopes.projects.find((p) => p.key === projectKey);
  const [name, setName] = useState(existing?.name ?? '');
  const target = useAmount(existing?.target);
  const bal = existing ? balance(data.envelopes, existing.key) : 0;

  const save = () => {
    target.setTouched(true);
    if (!name.trim()) return toast('Donne un nom au projet.', 'error');
    if (!target.valid) return;
    if (dispatch({ type: 'env/project/save', key: existing?.key, name, target: target.cents! })) {
      toast(existing ? 'Projet modifié' : 'Projet créé', 'success');
      onClose();
    }
  };

  return (
    <Sheet title={existing ? 'Modifier le projet' : 'Nouveau projet'} subtitle={existing ? undefined : 'Une enveloppe à remplir petit à petit, avec un objectif.'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nom">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Nouveau téléphone, vacances…" maxLength={40} autoFocus={!existing} />
        </Field>
        <AmountField label="Objectif" amount={target} big />
        <button type="submit" className="btn btn-primary btn-block btn-xl">
          <Icon name="check" size={20} strokeWidth={2.4} /> {existing ? 'Enregistrer' : 'Créer le projet'}
        </button>
        {existing && (
          <button
            type="button"
            className="btn btn-danger btn-block"
            disabled={bal !== 0}
            onClick={() => {
              if (dispatch({ type: 'env/project/delete', key: existing.key })) {
                toast('Projet supprimé');
                onClose();
              }
            }}
          >
            Supprimer le projet
          </button>
        )}
        {existing && bal !== 0 && <p className="tiny center" style={{ margin: 0 }}>Pour le supprimer, transfère d’abord ses {money(bal)} vers une autre enveloppe.</p>}
      </form>
    </Sheet>
  );
}
