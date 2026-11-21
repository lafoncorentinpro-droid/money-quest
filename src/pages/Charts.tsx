import { useState } from 'react';
import { periodRange, periodShort } from '../domain/dates';
import { monthProgress, monthSummary, rangeStats, yearSummary } from '../domain/finance';
import { percent } from '../domain/money';
import { useStore } from '../store/store';
import { PageHead, PeriodSwitcher } from '../ui/components';
import { Icon } from '../ui/Icon';

const PALETTE = ['#29465D', '#7899B5', '#E8893F', '#E6C372', '#B9D9EF'];

interface Slice {
  key: string;
  label: string;
  amount: number;
  color: string;
}

/** Anneau des dépenses (SVG) : chaque part est un arc. */
function Donut({ slices, center }: { slices: Slice[]; center: string }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const total = slices.reduce((a, s) => a + s.amount, 0) || 1;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 180 180" role="img" aria-label={`Dépensé ${center}`}>
        <circle cx="90" cy="90" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="30" />
        {slices.map((s) => {
          const len = (s.amount / total) * C;
          const gap = slices.length > 1 ? Math.min(2.5, len / 3) : 0;
          const el = (
            <circle
              key={s.key}
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="30"
              strokeDasharray={`${Math.max(0, len - gap)} ${C - len + gap}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="donut-center">
        <span>Dépensé</span>
        <strong className="num">{center}</strong>
      </div>
    </div>
  );
}

/** Bilan du mois (maquette 03-Bilan-du-mois). */
export function ChartsPage() {
  const { data, today, period: current, month, setMonth, money } = useStore();
  const r = periodRange(month, 1);
  const s = monthSummary(data, month);
  const prog = monthProgress(data, month, today);
  const stats = rangeStats(data, r, today);
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? 'Autre';
  const base = s.incomesReceived;
  const spent = s.expensesRealized;
  const rest = base - spent;
  const timePct = percent(prog.day, prog.days);
  const budgetPct = base > 0 ? percent(spent, base) : 0;

  const top = stats.byCategory.slice(0, 4);
  const others = stats.byCategory.slice(4).reduce((a, c) => a + c.amount, 0);
  const slices: Slice[] = top.map((c, i) => ({ key: c.categoryId, label: catName(c.categoryId), amount: c.amount, color: PALETTE[i] }));
  if (others > 0) slices.push({ key: 'autres', label: 'Autres', amount: others, color: PALETTE[4] });
  const euros = (c: number) => money(Math.round(c / 100) * 100).replace(/,00\s?/, ' ').replace(/\s+€/, ' €');

  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const y = yearSummary(data, year);
  const maxBar = Math.max(1, ...y.months.map((m) => Math.max(m.incomes, m.expenses)));
  const thisYear = Number(today.slice(0, 4));

  return (
    <div className="page">
      <PageHead title="Bilan du mois" backTo="accueil" />
      <PeriodSwitcher period={month} onChange={setMonth} startDay={1} max={current} />

      <section className="card stack" aria-labelledby="rep">
        <h2 id="rep" className="card-title">
          Répartition des dépenses
        </h2>
        {spent === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>Aucune dépense payée ce mois-ci pour l’instant.</p>
        ) : (
          <div className="donut-row">
            <Donut slices={slices} center={euros(spent)} />
            <ul className="donut-legend">
              {slices.map((sl) => (
                <li key={sl.key}>
                  <i style={{ background: sl.color }} />
                  <span className="ellipsis">{sl.label}</span>
                  <strong className="num">{money(sl.amount)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="tiles-3">
          <div>
            <span>Budget</span>
            <strong className="num">{money(base)}</strong>
          </div>
          <div>
            <span>Dépensé</span>
            <strong className="num">{money(spent)}</strong>
          </div>
          <div className={rest < 0 ? 'is-warn' : 'is-ok'}>
            <span>Il reste</span>
            <strong className="num">{money(rest)}</strong>
          </div>
        </div>
      </section>

      <section className="card stack" aria-labelledby="ou">
        <div className="row-between">
          <h2 id="ou" className="card-title">
            Où j’en suis
          </h2>
          <span className="muted small">{prog.day === 0 ? 'Mois à venir' : prog.day >= prog.days ? 'Mois terminé' : `Jour ${prog.day} sur ${prog.days}`}</span>
        </div>
        <div className="meter">
          <div className="row-between">
            <span>Temps écoulé</span>
            <strong>{timePct} %</strong>
          </div>
          <div className="meter-bar is-time">
            <span style={{ width: `${timePct}%` }} />
          </div>
        </div>
        <div className="meter">
          <div className="row-between">
            <span>Budget utilisé</span>
            <strong>{budgetPct} %</strong>
          </div>
          <div className={`meter-bar ${budgetPct > 100 ? 'is-over' : 'is-budget'}`}>
            <span style={{ width: `${Math.min(100, budgetPct)}%` }} />
          </div>
        </div>
        {base > 0 && (
          <div className={`pace ${budgetPct <= timePct ? 'is-ok' : 'is-slow'}`}>
            <Icon name={budgetPct <= timePct ? 'check' : 'info'} size={20} strokeWidth={2.4} />
            <span>{budgetPct <= timePct ? 'Tu dépenses moins vite que le temps passe. Continue comme ça !' : 'Tu dépenses un peu plus vite que le temps passe. Rien de grave : garde un œil dessus.'}</span>
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="annee">
        <div className="row-between">
          <h2 id="annee" className="card-title">
            Bilan {year}
          </h2>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="sq-btn" onClick={() => setYear(year - 1)} aria-label="Année précédente">
              <Icon name="chevron-left" size={20} />
            </button>
            <button type="button" className="sq-btn" onClick={() => setYear(year + 1)} disabled={year >= thisYear} aria-label="Année suivante">
              <Icon name="chevron-right" size={20} />
            </button>
          </div>
        </div>
        <div className="year-stats">
          <div>
            <span>Budget</span>
            <strong className="num">{euros(y.incomes)}</strong>
          </div>
          <div>
            <span>Dépensé</span>
            <strong className="num">{euros(y.expenses)}</strong>
          </div>
          <div>
            <span>Économisé</span>
            <strong className={`num ${y.saved < 0 ? 'neg' : 'pos'}`}>{euros(y.saved)}</strong>
          </div>
        </div>
        <div className="bars" aria-hidden>
          {y.months.map((m) => {
            const isNow = m.period === current;
            const future = m.period > current;
            return (
              <div key={m.period} className="bar-col">
                <div className="bar-pair">
                  {future ? (
                    <div className="bar bar-future" />
                  ) : (
                    <>
                      <div className="bar bar-in" style={{ height: `${(m.incomes / maxBar) * 100}%` }} />
                      <div className={`bar ${isNow ? 'bar-now' : 'bar-out'}`} style={{ height: `${(m.expenses / maxBar) * 100}%` }} />
                    </>
                  )}
                </div>
                <span className={`bar-label ${isNow ? 'is-now' : ''}`}>{periodShort(m.period).slice(0, 1).toUpperCase()}</span>
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span>
            <i className="bar-in" />
            Budget de base
          </span>
          <span>
            <i className="bar-out" />
            Dépenses
          </span>
        </div>
      </section>
    </div>
  );
}
