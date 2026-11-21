import { useMemo, useState } from 'react';
import { addDays, formatDateShort, periodRange } from '../domain/dates';
import { monthSummary } from '../domain/finance';
import { useStore } from '../store/store';
import { Empty, PageHead, PeriodSwitcher } from '../ui/components';
import { Icon } from '../ui/Icon';
import { useSheets } from '../ui/sheets';
import { ChartsPage } from './Charts';
import { EnvHistory } from './EnvHistory';
import { buildRows, OpRowView } from './operations';
import { ExpensesStep, IncomesStep, MonthOverview } from './Month';

const TOOLS: Record<string, string> = {
  operations: 'Opérations'
};

export function Money({ sub }: { sub?: string; arg?: string }) {
  if (!sub) return <EnvHistory />;
  if (sub === 'bilan') return <ChartsPage />;
  if (sub && TOOLS[sub]) {
    return (
      <div className="page">
        <PageHead title={TOOLS[sub]} backTo="argent" />
        <Operations />
      </div>
    );
  }
  return (
    <div className="page">
      <header className="home-head">
        <div>
          <div className="home-month"><MonthYear /></div>
          <h1 className="page-title">Mon argent</h1>
        </div>
      </header>
      {sub === 'revenus' ? <IncomesStep /> : sub === 'depenses' ? <ExpensesStep /> : <MonthOverview />}
    </div>
  );
}

type TypeFilter = 'tout' | 'depenses' | 'revenus' | 'prevues';
type Sort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

/** Opérations du mois (maquette 04-Operations). */
function Operations() {
  const { data, today, month: period, setMonth: setPeriod, money } = useStore();
  const open = useSheets();
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('tout');
  const [cat, setCat] = useState('');
  const [nature, setNature] = useState('');
  const [sort, setSort] = useState<Sort>('date-desc');
  const s = monthSummary(data, period);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = buildRows(data, periodRange(period, 1)).filter((x) => x.kind !== 'movement');
    r = r.filter((x) => {
      if (type === 'depenses' && !(x.kind === 'expense' || (x.kind === 'occurrence' && x.sign === '−'))) return false;
      if (type === 'revenus' && !(x.kind === 'income' || (x.kind === 'occurrence' && x.sign === '+'))) return false;
      if (type === 'prevues' && !x.planned) return false;
      if (cat && x.categoryId !== cat) return false;
      if (nature && x.nature !== nature) return false;
      if (needle && !`${x.title} ${x.subtitle}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: (typeof r)[0], b: (typeof r)[0]) => number> = {
      'date-desc': (a, b) => b.date.localeCompare(a.date),
      'date-asc': (a, b) => a.date.localeCompare(b.date),
      'amount-desc': (a, b) => b.amount - a.amount,
      'amount-asc': (a, b) => a.amount - b.amount
    };
    return r.sort(cmp[sort]);
  }, [data, period, q, type, cat, nature, sort]);

  const signed = (list: typeof rows) => list.filter((r) => !r.cancelled).reduce((acc, r) => acc + (r.sign === '+' ? r.amount : -r.amount), 0);
  const total = (n: number) => `${n > 0 ? '+ ' : n < 0 ? '− ' : ''}${money(Math.abs(n))}`;
  const dayTitle = (d: string) => {
    const short = formatDateShort(d).toUpperCase();
    if (d === today) return 'AUJOURD’HUI';
    if (d === addDays(today, -1)) return `HIER · ${short}`;
    return short;
  };

  const byDate = sort.startsWith('date');
  const groups: { key: string; title: string; rows: typeof rows }[] = [];
  if (byDate) {
    const done = rows.filter((r) => !r.planned);
    const planned = rows.filter((r) => r.planned).sort((a, b) => a.date.localeCompare(b.date));
    for (const r of done) {
      const last = groups[groups.length - 1];
      if (last && last.key === r.date) last.rows.push(r);
      else groups.push({ key: r.date, title: dayTitle(r.date), rows: [r] });
    }
    if (planned.length) groups.push({ key: 'avenir', title: 'À VENIR', rows: planned });
  }

  return (
    <>
      <PeriodSwitcher period={period} onChange={setPeriod} startDay={1} />
      <div className="ops-tiles">
        <div>
          <span>Budget de base</span>
          <strong className="num pos">+ {money(s.incomesReceived)}</strong>
        </div>
        <div>
          <span>Dépenses</span>
          <strong className="num">− {money(s.expensesRealized)}</strong>
        </div>
        <div>
          <span>Il reste</span>
          <strong className={`num ${s.incomesReceived - s.expensesRealized < 0 ? 'neg' : 'gold'}`}>{money(s.incomesReceived - s.expensesRealized)}</strong>
        </div>
      </div>
      <label className="search">
        <Icon name="search" size={22} />
        <input type="search" placeholder="Rechercher une opération" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
      </label>
      <div className="chips ops-chips" role="group" aria-label="Filtrer par type">
        {(
          [
            ['tout', 'Tout'],
            ['depenses', 'Dépenses'],
            ['revenus', 'Budget de base'],
            ['prevues', 'À venir']
          ] as [TypeFilter, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={type === k} onClick={() => setType(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="ops-selects">
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
          <option value="">Catégories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={nature} onChange={(e) => setNature(e.target.value)} aria-label="Type">
          <option value="">Type</option>
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

      {rows.length === 0 ? (
        <section className="card">
          <Empty icon="🍃" title="Aucune opération">
            <span className="small">Rien ne correspond à cette période ou à ces filtres.</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => open({ kind: 'expense' })}>
              Ajouter une dépense
            </button>
          </Empty>
        </section>
      ) : byDate ? (
        groups.map((g) => (
          <section key={g.key} className="ops-group" aria-label={g.title}>
            <div className="ops-group-head">
              <span>{g.title}</span>
              <span className="num">{total(signed(g.rows))}</span>
            </div>
            <div className="card list">
              {g.rows.map((r) => (
                <OpRowView key={r.key} row={r} money={money} onOpen={open} dateLabel={r.planned ? formatDateShort(r.date) : undefined} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="card list">
          {rows.map((r) => (
            <OpRowView key={r.key} row={r} money={money} onOpen={open} showDate />
          ))}
        </div>
      )}
    </>
  );
}

function MonthYear() {
  const { month } = useStore();
  return <>{month.slice(0, 4)}</>;
}
