import { periodLabel } from '../domain/dates';
import { balance, EPARGNE, LASER, laserView, monthView, weekOfDate } from '../domain/envelopes';
import { useStore } from '../store/store';
import { PeriodSwitcher, useCountUp } from '../ui/components';
import { Icon } from '../ui/Icon';
import { Mascot } from '../ui/Mascot';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';

/** Accueil — méthode des enveloppes (salaire, fixes, épargne, 4 semaines, laser, achats divers). */
export function EnvelopesHome() {
  const { data, today, period: current, month, setMonth, money } = useStore();
  const open = useSheets();
  const env = data.envelopes;
  const v = monthView(env, month);
  const shown = useCountUp(v ? v.available : 0);
  const laser = laserView(env);
  const thisWeek = month === current ? weekOfDate(today) : 0;
  const label = periodLabel(month, 1);

  return (
    <div className="page home">
      <header className="home-head">
        <div>
          <div className="home-month">{label}</div>
          <h1 className="home-title">Mon budget</h1>
        </div>
        <button type="button" className="round-btn" onClick={() => go('reglages')} aria-label="Réglages">
          <Icon name="sliders" size={21} strokeWidth={2} />
        </button>
      </header>

      <PeriodSwitcher period={month} onChange={setMonth} startDay={1} />

      {!v ? (
        <section className="card stack center env-empty">
          <Mascot id={data.settings.mascot} size={110} hello animate={data.settings.animations} />
          <h2 className="card-title">{label.charAt(0).toUpperCase() + label.slice(1)} n’est pas encore créé</h2>
          <p className="muted" style={{ margin: 0 }}>
            Renseigne ton salaire : les dépenses fixes, l’épargne et tes 4 semaines sont reprises du mois précédent.
          </p>
          <button type="button" className="btn btn-primary btn-block btn-xl" onClick={() => open({ kind: 'env-month', period: month })}>
            <Icon name="plus" size={20} strokeWidth={2.4} /> Créer le mois
          </button>
        </section>
      ) : (
        <>
          <section className="hero-card" aria-labelledby="dispo">
            <div className="hero-mascot">
              <Mascot id={data.settings.mascot} size={104} hello animate={data.settings.animations} />
            </div>
            <h2 id="dispo" className="hero-label">
              Disponible ce mois
            </h2>
            <div className={`hero-big num ${v.available < 0 ? 'is-neg' : ''}`}>{money(shown)}</div>
            <div className="hero-small" style={{ marginTop: 4 }}>
              Semaines + achats divers
            </div>
            <div className="plan-lines">
              <div>
                <span>Salaire</span>
                <strong className="num">{money(v.plan.salary)}</strong>
              </div>
              <div>
                <span>Dépenses fixes</span>
                <strong className="num">− {money(v.plan.fixed)}</strong>
              </div>
              <div>
                <span>Épargne</span>
                <strong className="num">− {money(v.plan.savings)}</strong>
              </div>
            </div>
            <button type="button" className="hero-btn" onClick={() => open({ kind: 'env-month', period: month })}>
              <Icon name="sliders" size={18} strokeWidth={2} /> Modifier le mois
            </button>
          </section>

          <section aria-labelledby="sem">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <h2 id="sem" className="section-title" style={{ margin: 0 }}>
                Mes semaines
              </h2>
              <button type="button" className="link" onClick={() => open({ kind: 'env-transfer' })}>
                Transférer
              </button>
            </div>
            <div className="week-grid">
              {v.weeks.map((w) => {
                const pct = w.initial > 0 ? Math.max(0, Math.min(100, Math.round((w.balance / w.initial) * 100))) : 0;
                return (
                  <button key={w.key} type="button" className={`week-card ${w.n === thisWeek ? 'is-now' : ''}`} onClick={() => open({ kind: 'env', key: w.key })}>
                    <span className="week-name">
                      Semaine {w.n}
                      {w.n === thisWeek && <span className="tag tag-gold">Cette semaine</span>}
                    </span>
                    <strong className={`num ${w.balance < 0 ? 'neg' : ''}`}>{money(w.balance)}</strong>
                    <span className="week-of">sur {money(w.initial)}</span>
                    <span className="week-bar">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <button type="button" className="card env-card" onClick={() => open({ kind: 'env', key: v.divers.key })}>
            <span className="env-ico is-blue">
              <Icon name="card" size={22} />
            </span>
            <span className="grow">
              <strong>Achats divers</strong>
              <small>Vêtements, sorties, imprévus…</small>
            </span>
            <span className={`env-amount num ${v.divers.balance < 0 ? 'neg' : ''}`}>{money(v.divers.balance)}</span>
          </button>

          <button type="button" className="card env-card env-laser" onClick={() => open({ kind: 'env', key: LASER })}>
            <span className="env-ico is-gold">
              <Icon name="star" size={22} />
            </span>
            <span className="grow">
              <strong>Prochaine séance laser</strong>
              <small>
                {money(laser.balance)} / {money(laser.target)} · encore {money(laser.remaining)}
              </small>
              <span className="week-bar is-gold">
                <span style={{ width: `${laser.pct}%` }} />
              </span>
            </span>
            <span className="env-amount num">{laser.pct} %</span>
          </button>

          <button type="button" className="card env-card" onClick={() => open({ kind: 'env', key: EPARGNE })}>
            <span className="env-ico is-green">
              <Icon name="chest" size={22} />
            </span>
            <span className="grow">
              <strong>Épargne</strong>
              <small>{money(v.plan.savings)} mis de côté ce mois</small>
            </span>
            <span className="env-amount num">{money(balance(env, EPARGNE))}</span>
          </button>
        </>
      )}
    </div>
  );
}
