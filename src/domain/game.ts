import { periodRange, shiftPeriod } from './dates';
import { expensesByCategory, goalBalance } from './finance';
import type { Achievement, AppData, CosmeticItem, ISODate, Mission, PeriodKey, UserProgress, XpEvent, XpRule } from './types';

/**
 * Gamification : l'XP récompense des HABITUDES (saisir, préparer, faire le point),
 * jamais des montants. L'XP ne diminue jamais, les régions et badges ne se perdent jamais.
 */

export const MAX_LEVEL = 100;

export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  return Math.round(30 * Math.pow(level - 1, 1.6));
}

export function totalXp(p: UserProgress): number {
  return p.xpEvents.reduce((a, e) => a + e.xp, 0);
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < MAX_LEVEL && levelThreshold(lvl + 1) <= xp) lvl++;
  return lvl;
}

export function levelProgress(xp: number): { level: number; into: number; needed: number; pct: number } {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, needed: 0, pct: 100 };
  const base = levelThreshold(level);
  const next = levelThreshold(level + 1);
  return { level, into: xp - base, needed: next - base, pct: Math.floor(((xp - base) / (next - base)) * 100) };
}

export const XP_RULE_INFO: Record<Exclude<XpRule, 'mission'>, { label: string; detail: string }> = {
  saisie: { label: 'Enregistrer ses opérations', detail: 'une fois par jour, dès la première opération saisie' },
  budget: { label: 'Préparer son budget', detail: 'une fois par mois budgétaire' },
  bilan: { label: 'Faire son bilan', detail: 'une fois par mois, en ouvrant le bilan' },
  revue: { label: 'Vérifier ses dépenses récurrentes', detail: 'une fois par mois' },
  epargne: { label: 'Contribuer à un objectif', detail: 'une fois par jour, quel que soit le montant' }
};

export const DEFAULT_XP_RULES: Record<XpRule, number> = { saisie: 10, budget: 40, bilan: 25, revue: 20, epargne: 15, mission: 100 };

/* ----- Régions ----- */

export interface Collectible {
  id: string;
  name: string;
  icon: string;
  level: number;
  description: string;
}

export interface Region {
  id: string;
  name: string;
  minLevel: number;
  maxLevel: number;
  description: string;
  color: string;
  collectibles: Collectible[];
}

export const REGIONS: Region[] = [
  {
    id: 'village',
    name: 'Village des Premiers Pas',
    minLevel: 1,
    maxLevel: 5,
    description: 'Premières habitudes : découvrir ses revenus et dépenses, préparer un premier budget.',
    color: '#E9C98B',
    collectibles: [
      { id: 'cle-maison', name: 'Clé de la maison', icon: '🗝️', level: 1, description: 'La porte du QG du renard.' },
      { id: 'carnet', name: 'Carnet de bord', icon: '📔', level: 2, description: 'Pour noter chaque pas.' },
      { id: 'pain', name: 'Miche du moulin', icon: '🥖', level: 3, description: 'Le boulanger du village te salue.' },
      { id: 'lampe', name: 'Lampe de la place', icon: '🏮', level: 5, description: 'Elle éclaire le chemin vers la forêt.' }
    ]
  },
  {
    id: 'foret',
    name: 'Forêt des Économies',
    minLevel: 6,
    maxLevel: 15,
    description: 'Une épargne régulière et la maîtrise de tes catégories de dépenses.',
    color: '#9FBF9A',
    collectibles: [
      { id: 'gland', name: 'Gland doré', icon: '🌰', level: 6, description: 'Petit à petit, la forêt grandit.' },
      { id: 'champignon', name: 'Champignon lumineux', icon: '🍄', level: 9, description: 'Il brille dans les clairières.' },
      { id: 'plume', name: 'Plume de chouette', icon: '🪶', level: 12, description: 'La chouette garde les sentiers.' },
      { id: 'lanterne-foret', name: 'Lanterne des sous-bois', icon: '🪔', level: 15, description: 'Elle ouvre la route du lac.' }
    ]
  },
  {
    id: 'lac',
    name: 'Lac des Trésors',
    minLevel: 16,
    maxLevel: 30,
    description: 'Créer et suivre plusieurs objectifs d’épargne.',
    color: '#8DBBD9',
    collectibles: [
      { id: 'coquillage', name: 'Coquillage nacré', icon: '🐚', level: 16, description: 'Trouvé sur le ponton.' },
      { id: 'canne', name: 'Canne du pêcheur', icon: '🎣', level: 20, description: 'Patience et régularité.' },
      { id: 'perle', name: 'Perle du lac', icon: '🫧', level: 25, description: 'Un trésor tranquille.' },
      { id: 'coffre', name: 'Coffre ancien', icon: '🧰', level: 30, description: 'Il contient la carte des montagnes.' }
    ]
  },
  {
    id: 'montagnes',
    name: 'Montagnes Dorées',
    minLevel: 31,
    maxLevel: 60,
    description: 'Des habitudes durables, la planification et la stabilité.',
    color: '#D9B86A',
    collectibles: [
      { id: 'cristal', name: 'Cristal de roche', icon: '💎', level: 31, description: 'Solide comme tes habitudes.' },
      { id: 'longue-vue', name: 'Longue-vue', icon: '🔭', level: 40, description: 'Depuis l’observatoire, on voit loin.' },
      { id: 'edelweiss', name: 'Edelweiss', icon: '🌼', level: 50, description: 'Fleur rare des sommets.' },
      { id: 'cloche', name: 'Cloche du col', icon: '🔔', level: 60, description: 'Elle annonce le royaume.' }
    ]
  },
  {
    id: 'royaume',
    name: 'Royaume des Légendes',
    minLevel: 61,
    maxLevel: 100,
    description: 'La maîtrise de ton organisation et de tes objectifs de long terme.',
    color: '#C9A7D9',
    collectibles: [
      { id: 'blason', name: 'Blason du renard', icon: '🛡️', level: 61, description: 'Ton emblème d’aventurier.' },
      { id: 'parchemin', name: 'Parchemin des sages', icon: '📜', level: 75, description: 'Les secrets d’un budget serein.' },
      { id: 'etoile', name: 'Étoile du royaume', icon: '🌟', level: 90, description: 'Elle brille pour toi.' },
      { id: 'couronne-legende', name: 'Couronne légendaire', icon: '👑', level: 100, description: 'Le sommet de l’aventure.' }
    ]
  }
];

export function regionForLevel(level: number): Region {
  return [...REGIONS].reverse().find((r) => level >= r.minLevel) ?? REGIONS[0];
}

/* ----- Cosmétiques ----- */

export const COSMETICS: CosmeticItem[] = [
  { id: 'echarpe-bleue', slot: 'scarf', name: 'Écharpe bleue', level: 1 },
  { id: 'echarpe-sauge', slot: 'scarf', name: 'Écharpe sauge', level: 4 },
  { id: 'echarpe-doree', slot: 'scarf', name: 'Écharpe dorée', level: 15 },
  { id: 'echarpe-nuit', slot: 'scarf', name: 'Écharpe nuit étoilée', level: 31 },
  { id: 'chapeau-explorateur', slot: 'hat', name: 'Chapeau d’explorateur', level: 3 },
  { id: 'bonnet', slot: 'hat', name: 'Bonnet douillet', level: 8 },
  { id: 'couronne-fleurs', slot: 'hat', name: 'Couronne de fleurs', level: 20 },
  { id: 'couronne', slot: 'hat', name: 'Couronne des légendes', level: 61 },
  { id: 'lanterne', slot: 'accessory', name: 'Lanterne', level: 6 },
  { id: 'carte', slot: 'accessory', name: 'Carte au trésor', level: 10 },
  { id: 'boussole', slot: 'accessory', name: 'Boussole', level: 25 },
  { id: 'etoile', slot: 'accessory', name: 'Petite étoile', level: 45 }
];

/* ----- Missions ----- */

export const MISSIONS: Mission[] = [
  { id: 'premier-revenu', title: 'Noter un premier revenu', description: 'Ajoute ton salaire ou un autre revenu (reçu ou récurrent).', xp: 40, repeat: 'once', optional: false, region: 'village' },
  { id: 'budget-mois', title: 'Préparer le budget du mois', description: 'Fixe au moins une limite de catégorie pour ce mois.', xp: 30, repeat: 'period', optional: false, region: 'village' },
  { id: 'sept-jours', title: 'Sept jours de suivi', description: 'Enregistre des opérations sur 7 jours différents.', xp: 60, repeat: 'once', optional: false, region: 'village' },
  { id: 'objectif', title: 'Définir un objectif d’épargne', description: 'Crée ton premier trésor à remplir, à ton rythme.', xp: 40, repeat: 'once', optional: false, region: 'foret' },
  { id: 'premier-versement', title: 'Premier versement', description: 'Mets de côté le montant de ton choix, même petit.', xp: 30, repeat: 'once', optional: false, region: 'foret' },
  { id: 'bilan-mois', title: 'Consulter son bilan', description: 'Ouvre le bilan de ce mois ou du précédent.', xp: 25, repeat: 'period', optional: false, region: 'lac' },
  { id: 'revue-recurrences', title: 'Vérifier ses récurrences', description: 'Passe en revue tes charges fixes et abonnements.', xp: 20, repeat: 'period', optional: true, region: 'lac' },
  { id: 'limite-categorie', title: 'Respecter une limite choisie', description: 'Choisis une catégorie et une limite réaliste pour le mois ; validée à la fin du mois si elle est respectée.', xp: 50, repeat: 'period', optional: true, region: 'montagnes' }
];

export const DEFAULT_ACTIVE_MISSIONS = MISSIONS.map((m) => m.id);

/* ----- Badges ----- */

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'premiere-depense', title: 'Première dépense notée', description: 'Tu as enregistré ta première dépense.', icon: '🪙' },
  { id: 'premier-revenu', title: 'Premier revenu', description: 'Ton premier revenu est noté.', icon: '💧' },
  { id: 'premier-budget', title: 'Premier budget', description: 'Tu as préparé un budget.', icon: '🧭' },
  { id: 'semaine-suivi', title: 'Une semaine de suivi', description: 'Des opérations notées sur 7 jours différents.', icon: '📅' },
  { id: 'premier-objectif', title: 'Premier trésor', description: 'Tu as créé un objectif d’épargne.', icon: '🗺️' },
  { id: 'objectif-atteint', title: 'Trésor rempli', description: 'Un objectif d’épargne est atteint.', icon: '🏆' },
  { id: 'mois-termine', title: 'Mois bouclé', description: 'Tu as consulté le bilan d’un mois terminé.', icon: '🌙' },
  { id: 'regularite', title: 'Régularité', description: 'Des opérations notées sur 30 jours différents.', icon: '🌿' }
];

/* ----- Moteur ----- */

let counter = 0;
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1e6;
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rnd}`;
}

/** Attribue de l'XP une seule fois par clé. Renvoie la progression (inchangée si déjà attribuée). */
export function award(p: UserProgress, rule: XpRule, key: string, xp: number, date: ISODate, label: string): UserProgress {
  if (xp <= 0 || p.xpEvents.some((e) => e.key === key)) return p;
  const ev: XpEvent = { id: uid('xp'), rule, key, xp, date, label };
  return { ...p, xpEvents: [...p.xpEvents, ev] };
}

export function loggingDays(p: UserProgress): number {
  return p.xpEvents.filter((e) => e.rule === 'saisie').length;
}

function missionDone(p: UserProgress, id: string, period: string): boolean {
  return p.missionCompletions.some((c) => c.missionId === id && c.period === period);
}

/** Vérifie si une mission est accomplie avec les données actuelles. */
export function missionSatisfied(data: AppData, m: Mission, period: PeriodKey, today: ISODate): boolean {
  const p = data.progress;
  switch (m.id) {
    case 'premier-revenu':
      return data.incomes.some((i) => i.status === 'recu') || data.recurring.some((r) => r.kind === 'income');
    case 'budget-mois':
      return (data.budgets[period]?.categories.length ?? 0) > 0;
    case 'sept-jours':
      return loggingDays(p) >= 7;
    case 'objectif':
      return data.goals.length > 0;
    case 'premier-versement':
      return data.movements.some((mv) => mv.type === 'versement');
    case 'bilan-mois':
      return p.bilansViewed.includes(period) || p.bilansViewed.includes(shiftPeriod(period, -1));
    case 'revue-recurrences':
      return p.recurringReviews.includes(period);
    case 'limite-categorie': {
      const ch = p.categoryChallenge;
      if (!ch || ch.period !== period) return false;
      const r = periodRange(ch.period, data.settings.monthStartDay);
      if (today <= r.end) return false; // validée seulement une fois le mois terminé
      return (expensesByCategory(data, r)[ch.categoryId] ?? 0) <= ch.limit;
    }
    default:
      return false;
  }
}

/** Période de référence d'une mission (pour les missions mensuelles). */
export function missionPeriodKey(m: Mission, period: PeriodKey): string {
  return m.repeat === 'once' ? 'once' : period;
}

export interface MissionView {
  mission: Mission;
  done: boolean;
  active: boolean;
  progressLabel?: string;
}

export function missionsView(data: AppData, period: PeriodKey): MissionView[] {
  const p = data.progress;
  return MISSIONS.map((m) => {
    const done = missionDone(p, m.id, missionPeriodKey(m, period));
    let progressLabel: string | undefined;
    if (m.id === 'sept-jours' && !done) progressLabel = `${Math.min(7, loggingDays(p))} / 7 jours`;
    if (m.id === 'limite-categorie' && p.categoryChallenge?.period === period) progressLabel = 'Défi en cours ce mois-ci';
    return { mission: m, done, active: data.settings.activeMissions.includes(m.id), progressLabel };
  });
}

/**
 * Met à jour missions, badges et régions après chaque action. Pure et idempotente.
 * `period` = mois budgétaire courant.
 */
export function refreshProgress(data: AppData, period: PeriodKey, today: ISODate): AppData {
  let p = data.progress;

  // Missions mensuelles : on vérifie aussi le défi « limite » du mois précédent, évaluable une fois terminé.
  for (const m of MISSIONS) {
    if (!data.settings.activeMissions.includes(m.id)) continue;
    const periods = m.id === 'limite-categorie' && p.categoryChallenge ? [p.categoryChallenge.period] : [period];
    for (const per of periods) {
      const key = missionPeriodKey(m, per);
      if (missionDone(p, m.id, key)) continue;
      if (!missionSatisfied({ ...data, progress: p }, m, per, today)) continue;
      p = { ...p, missionCompletions: [...p.missionCompletions, { missionId: m.id, period: key, date: today }] };
      const xp = Math.round((m.xp * (data.settings.xpRules.mission ?? 100)) / 100);
      p = award(p, 'mission', `mission:${m.id}:${key}`, xp, today, `Mission : ${m.title}`);
    }
  }

  // Badges (jamais retirés)
  const ach = { ...p.achievements };
  const unlock = (id: string, cond: boolean) => {
    if (cond && !ach[id]) ach[id] = today;
  };
  unlock('premiere-depense', data.expenses.length > 0);
  unlock('premier-revenu', data.incomes.some((i) => i.status === 'recu'));
  unlock('premier-budget', Object.values(data.budgets).some((b) => b.categories.length > 0 || b.savingsTarget > 0));
  unlock('semaine-suivi', loggingDays(p) >= 7);
  unlock('premier-objectif', data.goals.length > 0);
  unlock('objectif-atteint', data.goals.some((g) => g.reachedAt || (g.target > 0 && goalBalance(g.id, data.movements) >= g.target)));
  unlock(
    'mois-termine',
    p.bilansViewed.some((b) => periodRange(b, data.settings.monthStartDay).end < today)
  );
  unlock('regularite', loggingDays(p) >= 30);
  p = { ...p, achievements: ach };

  // Régions : débloquées définitivement
  const level = levelFromXp(totalXp(p));
  const regions = { ...p.unlockedRegions };
  for (const r of REGIONS) if (level >= r.minLevel && !regions[r.id]) regions[r.id] = today;
  p = { ...p, unlockedRegions: regions };

  // Objectifs atteints : date mémorisée
  const goals = data.goals.map((g) => (!g.reachedAt && g.target > 0 && goalBalance(g.id, data.movements) >= g.target ? { ...g, reachedAt: today } : g));

  return { ...data, goals, progress: p };
}
