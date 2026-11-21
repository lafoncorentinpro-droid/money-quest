import { useEffect, useRef, useState } from 'react';
import { makeBackup, parseBackup, toCSV, type ValidationResult } from '../domain/backup';
import { formatDateShort, periodLabel } from '../domain/dates';
import { ACHIEVEMENTS, COSMETICS, DEFAULT_XP_RULES, levelProgress, MISSIONS, totalXp, XP_RULE_INFO } from '../domain/game';
import { centsToInput, parseAmount } from '../domain/money';
import type { AppData, Equipment, Theme, XpRule } from '../domain/types';
import { requestPersistence } from '../store/db';
import { useStore } from '../store/store';
import { Confirm, Field, PageHead, Progress, Sheet, Switch } from '../ui/components';
import { Fox } from '../ui/Fox';

const CURRENCIES = [
  ['EUR', 'Euro (€)'],
  ['CHF', 'Franc suisse (CHF)'],
  ['CAD', 'Dollar canadien ($ CA)'],
  ['USD', 'Dollar US ($)'],
  ['GBP', 'Livre sterling (£)'],
  ['XOF', 'Franc CFA (XOF)'],
  ['MAD', 'Dirham marocain (MAD)']
];

async function shareOrDownload(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Profile() {
  const { data, dispatch, toast, period, today } = useStore();
  const s = data.settings;
  const xp = totalXp(data.progress);
  const lp = levelProgress(xp);
  const [nick, setNick] = useState(s.nickname);
  const [opening, setOpening] = useState(s.openingBalance ? (s.openingBalance.amount < 0 ? '-' : '') + centsToInput(s.openingBalance.amount) : '');
  const [importRes, setImportRes] = useState<ValidationResult | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showXp, setShowXp] = useState(false);
  const [persisted, setPersisted] = useState<boolean | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (settings: Partial<AppData['settings']>) => dispatch({ type: 'settings/update', settings });
  const equip = (e: Partial<Equipment>) => dispatch({ type: 'equip', equipped: { ...data.progress.equipped, ...e } });

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => undefined);
  }, []);

  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;

  const exportJson = async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    await shareOrDownload(`money-quest-sauvegarde-${stamp}.json`, JSON.stringify(makeBackup(data), null, 2), 'application/json');
    set({ lastBackupAt: new Date().toISOString() });
    toast('Sauvegarde exportée', 'success');
  };
  const exportCsv = async () => {
    await shareOrDownload(`money-quest-operations-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data), 'text/csv;charset=utf-8');
    toast('CSV exporté', 'success');
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      setImportRes({ ok: false, errors: ['Fichier trop volumineux (20 Mo max).'] });
      return;
    }
    setImportRes(parseBackup(await f.text()));
    if (fileRef.current) fileRef.current.value = '';
  };

  const saveOpening = () => {
    const t = opening.trim();
    if (!t) {
      set({ openingBalance: undefined });
      toast('Solde de départ retiré');
      return;
    }
    const neg = t.startsWith('-');
    const c = parseAmount(neg ? t.slice(1) : t);
    if (c === null) {
      toast('Montant invalide', 'error');
      return;
    }
    set({ openingBalance: { amount: neg ? -c : c, period } });
    toast(`Solde de départ appliqué à ${periodLabel(period, s.monthStartDay)}`, 'success');
  };

  const daysSinceBackup = s.lastBackupAt ? Math.floor((Date.now() - Date.parse(s.lastBackupAt)) / 86400000) : null;

  return (
    <div className="page">
      <PageHead title="Profil" />

      <section className="card stack center">
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <Fox mood="fier" size={120} equipped={data.progress.equipped} animate={s.animations} />
        </div>
        <strong style={{ fontSize: 20 }}>{s.nickname || 'Aventurier·e'}</strong>
        <div className="small muted">
          Niveau {lp.level} · {xp} XP
        </div>
        <Progress value={lp.into} max={lp.needed || 1} tone="xp" label="Progression du niveau" />
      </section>

      <section className="card stack">
        <Field label="Prénom ou pseudo (facultatif)">
          <input className="input" value={nick} maxLength={30} onChange={(e) => setNick(e.target.value)} onBlur={() => nick !== s.nickname && set({ nickname: nick.trim() })} />
        </Field>
      </section>

      <section className="card stack" aria-labelledby="wardrobe">
        <h2 id="wardrobe">Garde-robe du renard</h2>
        <p className="tiny" style={{ margin: 0 }}>
          Objets purement décoratifs, débloqués avec les niveaux. Jamais d’achat.
        </p>
        {(['scarf', 'hat', 'accessory'] as const).map((slot) => (
          <div key={slot} className="stack" style={{ gap: 6 }}>
            <h3 className="small muted">{slot === 'scarf' ? 'Écharpes' : slot === 'hat' ? 'Chapeaux' : 'Accessoires'}</h3>
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {slot !== 'scarf' && (
                <button type="button" className="chip" aria-pressed={!data.progress.equipped[slot]} onClick={() => equip({ [slot]: undefined })}>
                  Aucun
                </button>
              )}
              {COSMETICS.filter((c) => c.slot === slot).map((c) => {
                const ok = lp.level >= c.level;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="chip"
                    disabled={!ok}
                    aria-pressed={data.progress.equipped[slot] === c.id}
                    onClick={() => equip({ [slot]: c.id })}
                    style={{ opacity: ok ? 1 : 0.5 }}
                  >
                    {ok ? '' : '🔒 '}
                    {c.name}
                    {!ok && <span className="tiny"> niv. {c.level}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="card stack" aria-labelledby="badges">
        <h2 id="badges">Badges</h2>
        <div className="badge-grid">
          {ACHIEVEMENTS.map((a) => {
            const got = data.progress.achievements[a.id];
            return (
              <div key={a.id} className={`badge-item ${got ? '' : 'locked'}`}>
                <div className="medal" aria-hidden>
                  {a.icon}
                </div>
                <strong>{a.title}</strong>
                <span className="tiny">{got ? `Obtenu le ${formatDateShort(got)}` : a.description}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card stack" aria-labelledby="xprules">
        <div className="row-between">
          <h2 id="xprules">Règles d’XP</h2>
          <button type="button" className="link" onClick={() => setShowXp(true)}>
            Historique
          </button>
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          L’XP récompense tes habitudes, jamais les montants. Elle ne diminue jamais. Tu peux ajuster les valeurs.
        </p>
        {(Object.keys(XP_RULE_INFO) as Exclude<XpRule, 'mission'>[]).map((k) => (
          <div key={k} className="row">
            <div className="grow">
              <div className="small">{XP_RULE_INFO[k].label}</div>
              <div className="tiny">{XP_RULE_INFO[k].detail}</div>
            </div>
            <input
              className="input num"
              style={{ width: 76, textAlign: 'right' }}
              inputMode="numeric"
              aria-label={`XP pour ${XP_RULE_INFO[k].label}`}
              value={s.xpRules[k]}
              onChange={(e) => {
                const v = Math.max(0, Math.min(200, Number(e.target.value.replace(/\D/g, '')) || 0));
                set({ xpRules: { ...s.xpRules, [k]: v } });
              }}
            />
          </div>
        ))}
        <div className="row">
          <div className="grow">
            <div className="small">Missions</div>
            <div className="tiny">% de la récompense affichée sur chaque mission</div>
          </div>
          <input
            className="input num"
            style={{ width: 76, textAlign: 'right' }}
            inputMode="numeric"
            aria-label="Pourcentage XP missions"
            value={s.xpRules.mission}
            onChange={(e) => set({ xpRules: { ...s.xpRules, mission: Math.max(0, Math.min(300, Number(e.target.value.replace(/\D/g, '')) || 0)) } })}
          />
        </div>
        <button type="button" className="btn btn-sm" onClick={() => set({ xpRules: { ...DEFAULT_XP_RULES } })}>
          Valeurs par défaut
        </button>
        <h3 className="small muted">Missions suivies</h3>
        {MISSIONS.map((m) => (
          <Switch
            key={m.id}
            label={m.title}
            checked={s.activeMissions.includes(m.id)}
            onChange={(v) => set({ activeMissions: v ? [...s.activeMissions, m.id] : s.activeMissions.filter((x) => x !== m.id) })}
          />
        ))}
      </section>

      <section className="card stack" aria-labelledby="prefs">
        <h2 id="prefs">Préférences</h2>
        <Field label="Devise" hint="Change uniquement l’affichage : aucun montant n’est converti.">
          <select className="input" value={s.currency} onChange={(e) => set({ currency: e.target.value })}>
            {CURRENCIES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Premier jour du mois budgétaire" hint="Ex. 25 si ton salaire arrive le 25. Les opérations restent à leur date.">
          <select className="input" value={s.monthStartDay} onChange={(e) => set({ monthStartDay: Number(e.target.value) })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Le {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Thème">
          <div className="segmented" role="group" aria-label="Thème">
            {(
              [
                ['auto', 'Auto'],
                ['clair', 'Clair'],
                ['sombre', 'Sombre']
              ] as [Theme, string][]
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={s.theme === k} onClick={() => set({ theme: k })}>
                {l}
              </button>
            ))}
          </div>
        </Field>
        <Switch label="Animations" checked={s.animations} onChange={(v) => set({ animations: v })} />
        <div className="stack" style={{ gap: 0 }}>
          <Field label="Solde de départ (facultatif)" hint={`Ajouté au disponible estimé de ${periodLabel(s.openingBalance?.period ?? period, s.monthStartDay)}. Mets « - » devant pour un découvert.`}>
            <div className="row">
              <input className="input" inputMode="text" placeholder="0,00 €" value={opening} onChange={(e) => setOpening(e.target.value)} />
              <button type="button" className="btn" onClick={saveOpening}>
                OK
              </button>
            </div>
          </Field>
        </div>
      </section>

      <section className="card stack" aria-labelledby="notif">
        <h2 id="notif">Alertes</h2>
        <p className="tiny" style={{ margin: 0 }}>
          Les alertes s’affichent dans l’application, à l’ouverture. Les notifications programmées sur iPhone nécessitent un serveur d’envoi, que cette version n’utilise pas (pour que tes
          données restent privées).
        </p>
        <Switch label="Budget proche de sa limite" checked={s.alerts.budget} onChange={(v) => set({ alerts: { ...s.alerts, budget: v } })} />
        <Switch label="Échéances proches" checked={s.alerts.echeances} onChange={(v) => set({ alerts: { ...s.alerts, echeances: v } })} />
        <Switch label="Rappel de saisie du jour" checked={s.alerts.rappelSaisie} onChange={(v) => set({ alerts: { ...s.alerts, rappelSaisie: v } })} />
      </section>

      <section className="card stack" aria-labelledby="data">
        <h2 id="data">Mes données</h2>
        <div className="notice notice-info small">
          <span aria-hidden>🔒</span>
          <span>
            Tes données restent sur cet appareil, dans le stockage du navigateur. Rien n’est envoyé sur internet, il n’y a pas de synchronisation entre appareils. Si tu effaces les données de
            Safari, désinstalles l’app ou perds ton téléphone, elles sont perdues : <strong>exporte une sauvegarde régulièrement</strong> (Fichiers, iCloud Drive…).
          </span>
        </div>
        <div className={`notice small ${daysSinceBackup === null || daysSinceBackup > 30 ? 'notice-warn' : 'notice-success'}`}>
          {daysSinceBackup === null ? 'Aucune sauvegarde exportée pour l’instant.' : daysSinceBackup === 0 ? 'Dernière sauvegarde : aujourd’hui.' : `Dernière sauvegarde : il y a ${daysSinceBackup} jour${daysSinceBackup > 1 ? 's' : ''}.`}
        </div>
        {persisted === false && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              const ok = await requestPersistence();
              setPersisted(ok);
              toast(ok ? 'Stockage protégé contre l’effacement automatique' : 'Le navigateur n’a pas accordé la protection (installe l’app sur l’écran d’accueil).');
            }}
          >
            Protéger le stockage
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={exportJson}>
          ⬇️ Exporter une sauvegarde (JSON)
        </button>
        <button type="button" className="btn" onClick={exportCsv}>
          📄 Exporter les opérations (CSV)
        </button>
        <label className="btn" style={{ position: 'relative' }}>
          ⬆️ Importer une sauvegarde
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>
          Réinitialiser l’application
        </button>
      </section>

      {!isStandalone && (
        <section className="card stack" aria-labelledby="install">
          <h2 id="install">Installer sur iPhone</h2>
          <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
            <li>Ouvre cette page dans <strong>Safari</strong>.</li>
            <li>
              Touche le bouton <strong>Partager</strong> (carré avec une flèche).
            </li>
            <li>
              Choisis <strong>« Sur l’écran d’accueil »</strong>, puis « Ajouter ».
            </li>
          </ol>
          <p className="tiny" style={{ margin: 0 }}>
            L’app fonctionne ensuite hors connexion. Les données de l’app installée et celles de Safari sont séparées : exporte puis importe une sauvegarde si tu as déjà commencé dans Safari.
          </p>
        </section>
      )}

      <p className="tiny center">MONEY QUEST 1.0 · aucune publicité, aucun traceur, aucun abonnement · {today}</p>

      {importRes && (
        <Sheet title="Importer une sauvegarde" onClose={() => setImportRes(null)}>
          {importRes.ok ? (
            <div className="stack">
              <p className="muted" style={{ margin: 0 }}>
                Sauvegarde valide{importRes.summary.exportedAt ? ` du ${formatDateShort(importRes.summary.exportedAt.slice(0, 10))}` : ''} :
              </p>
              <ul className="small" style={{ margin: 0 }}>
                <li>{importRes.summary.incomes} revenus</li>
                <li>{importRes.summary.expenses} dépenses</li>
                <li>{importRes.summary.recurring} récurrences</li>
                <li>{importRes.summary.budgets} budgets</li>
                <li>
                  {importRes.summary.goals} objectifs, {importRes.summary.movements} mouvements d’épargne
                </li>
              </ul>
              <div className="notice notice-warn small">⚠️ Tes données actuelles seront remplacées. Exporte-les d’abord si tu veux les garder.</div>
              <button type="button" className="btn" onClick={exportJson}>
                Exporter mes données actuelles d’abord
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (importRes.ok && dispatch({ type: 'data/replace', data: importRes.data })) {
                    toast('Sauvegarde restaurée', 'success');
                    setImportRes(null);
                  }
                }}
              >
                Remplacer par cette sauvegarde
              </button>
            </div>
          ) : (
            <div className="stack">
              <div className="notice notice-warn">Ce fichier ne peut pas être importé. Aucune donnée n’a été modifiée.</div>
              <ul className="small">
                {importRes.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </Sheet>
      )}

      {confirmReset && (
        <Confirm
          title="Tout effacer ?"
          message="Toutes tes opérations, budgets, objectifs et ta progression seront définitivement supprimés de cet appareil. Exporte une sauvegarde avant si besoin."
          danger
          requireText="EFFACER"
          confirmLabel="Tout effacer"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            dispatch({ type: 'data/reset' });
            setConfirmReset(false);
            toast('Application réinitialisée');
            window.location.hash = '/accueil';
          }}
        />
      )}

      {showXp && (
        <Sheet title="Historique d’XP" onClose={() => setShowXp(false)}>
          {data.progress.xpEvents.length === 0 ? (
            <p className="muted">Aucune XP pour l’instant.</p>
          ) : (
            <div className="list">
              {[...data.progress.xpEvents]
                .reverse()
                .slice(0, 100)
                .map((e) => (
                  <div key={e.id} className="row-between small" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>
                      {e.label}
                      <span className="tiny"> · {formatDateShort(e.date)}</span>
                    </span>
                    <span className="tag tag-gold">+{e.xp}</span>
                  </div>
                ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
