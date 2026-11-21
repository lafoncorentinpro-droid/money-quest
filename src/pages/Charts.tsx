import { useState } from 'react';
import { periodRange, periodShort } from '../domain/dates';
import { monthProgress, monthSummary, rangeStats, yearSummary } from '../domain/finance';
import { percent } from '../domain/money';
import { useStore } from '../store/store';
import { PageHead, PeriodSwitcher, Progress } from '../ui/components';
import { Icon } from '../ui/Icon';

const PALETTE = ['#e07a5f', '#3d85c6', '#e9b949', '#9b72cf', '#e5989b', '#5fa8d3', '#c08552', '#6d8b74', '#d96c9a', '#8d99ae'];
const REST_COLOR = '#5aa469';

interface Slice {
  key: string;
  label: string;
  amount: number;
  color: string;
}

/** Camembert (anneau) en SVG : chaque part est un arc de cercle. */
function Pie({ slices, center, centerLabel }: { slices: Slice[]; center: string; centerLabel: string }) {
  const R = 70;
  const C = 2 * Math.PI * R;
  const total = slices.reduce((a, s) => a + s.amount, 0) || 1;
  let offset = 0;
  return (
    <div className="pie-wrap">
      <svg viewBox="0 0 200 200" className="pie" role="img" aria-label={`${centerLabel} ${center}`}>
        <circle cx="100" cy="100" r={R} className="pie-empty" />
        {slices.map((s) => {
          const len = (s.amount / total) * C;
          const el = (
            <circle
              key={s.key}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="34"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 100 100)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="pie-center">
        <span className="tiny">{centerLabel}</span>
        <strong className="num">{center}</strong>
      </div>
    </div>
  );
}

export function ChartsPage() {
  const { data, today, period: current, month, setMonth, money } = useStore();
  const r = periodRange(month, 1);
  const s = monthSummary(data, month);
  const prog = monthProgress(data, month, today);
  const stats = rangeStats(data, r, today);
  const catName = (id: string) => data.categories.find((c) => c.id === id);
  const base = s.incomesReceived;
  const spent = s.expensesRealized;
  const rest = base - spent;

  const slices: Slice[] = stats.byCategory.map((c, i) => ({
    key: c.categoryId,
    label: `${catName(c.categoryId)?.icon ?? ''} ${catName(c.categoryId)?.name ?? 'Autre'}`,
    amount: c.amount,
    color: PALETTE[i % PALETTE.length]
  }));
  if (rest > 0) slices.push({ key: 'reste', label: '✨ Il te reste', amount: rest, color: REST_COLOR });
  const total = Math.max(base, spent);

  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const y = yearSummary(data, year);
  const maxBar = Math.max(1, ...y.months.map((m) => Math.max(m.incomes, m.expenses)));
  const thisYear = Number(today.slice(0, 4));

  return (
    <div className="page">
      <PageHead title="Bilan du mois" backTo="accueil" />
      <PeriodSwitcher period={month} onChange={setMonth} startDay={1} max={current} />

      <section className="card stack" aria-labelledby="pie-title">
        <h2 id="pie-title" className="sr-only">
          Répartition du budget de base
        </h2>
        {base === 0 && spent === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>Rien de noté ce mois-ci pour l’instant.</p>
        ) : (
          <Pie slices={slices} centerLabel={rest >= 0 ? 'Il te reste' : 'Dépassement'} center={money(Math.abs(rest))} />
        )}
        <div className="grid-3">
          <div className="stat">
            <div className="label">Budget de base</div>
            <div className="value num">{money(base)}</div>
          </div>
          <div className="stat">
            <div className="label">Dépensé</div>
            <div className="value num">{money(spent)}</div>
          </div>
          <div className="stat">
            <div className="label">Il reste</div>
            <div className={`value num ${rest < 0 ? 'neg' : 'pos'}`}>{money(rest)}</div>
          </div>
        </div>
        {slices.length > 0 && (
          <div className="list">
            {slices.map((sl) => (
              <div key={sl.key} className="row-between small pie-legend-row">
                <span className="ellipsis">
                  <i className="pie-dot" style={{ background: sl.color }} />
                  {sl.label}
                </span>
                <span className="num">
                  {money(sl.amount)} <span className="muted">· {percent(sl.amount, total)} %</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="ou">
        <h2 id="ou">Où j’en suis</h2>
        <div className="row-between small">
          <span>{prog.day >= prog.days ? 'Mois terminé' : prog.day === 0 ? 'Mois à venir' : `Jour ${prog.day} sur ${prog.days}`}</span>
          <span className="muted num">{base > 0 ? `${percent(spent, base)} % du budget dépensé` : ''}</span>
        </div>
        <Progress value={prog.day} max={prog.days} label="Avancement du mois" />
      </section>

      <section className="card stack" aria-labelledby="annee">
        <div className="row-between">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setYear(year - 1)} aria-label="Année précédente">
            <Icon name="chevron-left" />
          </button>
          <h2 id="annee">Bilan {year}</h2>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setYear(year + 1)} disabled={year >= thisYear} aria-label="Année suivante">
            <Icon name="chevron-right" />
          </button>
        </div>
        <div className="grid-3">
          <div className="stat">
            <div className="label">Budget de base</div>
            <div className="value num">{money(y.incomes)}</div>
          </div>
          <div className="stat">
            <div className="label">Dépensé</div>
            <div className="value num">{money(y.expenses)}</div>
          </div>
          <div className="stat">
            <div className="label">Économisé</div>
            <div className={`value num ${y.saved < 0 ? 'neg' : 'pos'}`}>{money(y.saved)}</div>
          </div>
        </div>
        <div className="bars" aria-hidden>
          {y.months.map((m) => (
            <div key={m.period} className="bar-col">
              <div className="bar-pair">
                <div className="bar bar-in" style={{ height: `${(m.incomes / maxBar) * 100}%` }} />
                <div className="bar bar-out" style={{ height: `${(m.expenses / maxBar) * 100}%` }} />
              </div>
              <span className="bar-label">{periodShort(m.period).slice(0, 1)}</span>
            </div>
          ))}
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
