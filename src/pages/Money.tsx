import { useMemo, useState } from 'react';
import { formatDateLong, periodRange } from '../domain/dates';
import { monthSummary } from '../domain/finance';
import { useStore } from '../store/store';
import { Empty, PageHead, PeriodSwitcher } from '../ui/components';
import { go } from '../ui/router';
import { useSheets } from '../ui/sheets';
import { BilanPage, BudgetPage, CalendarPage, CategoriesPage, RecurringPage, SimulatorPage, StatsPage } from './MoneyViews';
import { buildRows, OpRowView } from './operations';
import { ExpensesStep, IncomesStep, MonthOverview, SavingsStep } from './Month';

const TOOLS: Record<string, string> = {
  operations: 'Toutes les opérations',
  budget: 'Budget par catégorie',
  recurrences: 'Récurrences',
  calendrier: 'Calendrier',
  stats: 'Statistiques',
  simulateur: 'Simulateur'
};

export function Money({ sub, arg }: { sub?: string; arg?: string }) {
  if (sub === 'bilan') return <BilanPage period={arg} />;
  if (sub === 'categories') return <CategoriesPage />;
  if (sub && TOOLS[sub]) {
    return (
      <div className="page">
        <PageHead title={TOOLS[sub]} backTo="argent" />
        {sub === 'budget' ? (
          <BudgetPage />
        ) : sub === 'recurrences' ? (
          <RecurringPage />
        ) : sub === 'calendrier' ? (
          <CalendarPage />
        ) : sub === 'stats' ? (
          <StatsPage />
        ) : sub === 'simulateur' ? (
          <SimulatorPage />
        ) : (
          <Operations />
        )}
      </div>
    );
  }
  return (
    <div className="page">
      <header className="page-head">
        <h1>Mon argent</h1>
      </header>
      {sub === 'revenus' ? <IncomesStep /> : sub === 'depenses' ? <ExpensesStep /> : sub === 'epargne' ? <SavingsStep /> : <MonthOverview />}
    </div>
  );
}

type TypeFilter = 'tout' | 'depenses' | 'revenus' | 'epargne' | 'prevues';
type Sort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

function Operations() {
  const { data, month: period, setMonth: setPeriod, money } = useStore();
  const open = useSheets();
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('tout');
  const [cat, setCat] = useState('');
  const [nature, setNature] = useState('');
  const [sort, setSort] = useState<Sort>('date-desc');
  const startDay = data.settings.monthStartDay;
  const s = monthSummary(data, period);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = buildRows(data, periodRange(period, startDay));
    r = r.filter((x) => {
      if (type === 'depenses' && !(x.kind === 'expense' || (x.kind === 'occurrence' && x.sign === '−'))) return false;
      if (type === 'revenus' && !(x.kind === 'income' || (x.kind === 'occurrence' && x.sign === '+'))) return false;
      if (type === 'epargne' && x.kind !== 'movement') return false;
      if (type === 'prevues' && !x.planned) return false;
      if (cat && x.categoryId !== cat) return false;
      if (nature && x.nature !== nature) return false;
      if (needle && !`${x.title} ${x.subtitle}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: typeof r[0], b: typeof r[0]) => number> = {
      'date-desc': (a, b) => b.date.localeCompare(a.date),
      'date-asc': (a, b) => a.date.localeCompare(b.date),
      'amount-desc': (a, b) => b.amount - a.amount,
      'amount-asc': (a, b) => a.amount - b.amount
    };
    return r.sort(cmp[sort]);
  }, [data, period, startDay, q, type, cat, nature, sort]);

  const byDate = sort.startsWith('date');
  const groups: { date: string; rows: typeof rows }[] = [];
  if (byDate) {
    for (const r of rows) {
      const last = groups[groups.length - 1];
      if (last && last.date === r.date) last.rows.push(r);
      else groups.push({ date: r.date, rows: [r] });
    }
  }

  return (
    <>
      <PeriodSwitcher period={period} onChange={setPeriod} startDay={startDay} />
      <div className="grid-3">
        <div className="stat">
          <div className="label">Revenus</div>
          <div className="value num pos">{money(s.incomesReceived)}</div>
        </div>
        <div className="stat">
          <div className="label">Dépenses</div>
          <div className="value num">{money(s.expensesRealized)}</div>
        </div>
        <div className="stat">
          <div className="label">Épargne</div>
          <div className="value num">{money(s.savingsNet)}</div>
        </div>
      </div>
      <input className="input" type="search" placeholder="Rechercher une opération…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
      <div className="chips" role="group" aria-label="Filtrer par type">
        {(
          [
            ['tout', 'Tout'],
            ['depenses', 'Dépenses'],
            ['revenus', 'Revenus'],
            ['epargne', 'Épargne'],
            ['prevues', 'Prévues']
          ] as [TypeFilter, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={type === k} onClick={() => setType(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="grid-3">
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
          <option value="">Catégories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={nature} onChange={(e) => setNature(e.target.value)} aria-label="Fixe ou variable">
          <option value="">Fixe/var.</option>
          <option value="fixe">Fixes</option>
          <option value="variable">Variables</option>
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Trier">
          <option value="date-desc">Récentes</option>
          <option value="date-asc">Anciennes</option>
          <option value="amount-desc">Montant ↓</option>
          <option value="amount-asc">Montant ↑</option>
        </select>
      </div>

      <section className="card" aria-label="Liste des opérations">
        {rows.length === 0 ? (
          <Empty icon="🍃" title="Aucune opération">
            <span className="small">Rien ne correspond à cette période ou à ces filtres.</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => open({ kind: 'expense' })}>
              Ajouter une dépense
            </button>
          </Empty>
        ) : byDate ? (
          groups.map((g) => (
            <div key={g.date}>
              <div className="day-head">{formatDateLong(g.date)}</div>
              <div className="list">
                {g.rows.map((r) => (
                  <OpRowView key={r.key} row={r} money={money} onOpen={open} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="list">
            {rows.map((r) => (
              <OpRowView key={r.key} row={r} money={money} onOpen={open} showDate />
            ))}
          </div>
        )}
      </section>
      <div className="row wrap">
        <button type="button" className="btn btn-sm" onClick={() => go(`argent/bilan/${period}`)}>
          📜 Bilan du mois
        </button>
        <button type="button" className="btn btn-sm" onClick={() => go('argent/categories')}>
          🏷️ Catégories
        </button>
      </div>
    </>
  );
}
