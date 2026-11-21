/**
 * Modèle de données MONEY QUEST.
 * Règle d'or : tous les montants sont des entiers en CENTIMES, toujours positifs.
 * Le sens (entrée / sortie) est porté par le type de l'enregistrement, jamais par le signe.
 * Les dates sont des chaînes locales 'AAAA-MM-JJ' (pas d'heure, pas de fuseau).
 */

export type ID = string;
export type Cents = number;
export type ISODate = string; // 'AAAA-MM-JJ'
export type PeriodKey = string; // 'AAAA-MM' : mois budgétaire commençant au jour `monthStartDay`

export type IncomeType = 'salaire' | 'prime' | 'aide' | 'activite' | 'remboursement' | 'autre';
export type IncomeStatus = 'recu' | 'prevu' | 'annule';

export interface Income {
  id: ID;
  amount: Cents;
  date: ISODate;
  description: string;
  type: IncomeType;
  status: IncomeStatus;
  note?: string;
  /** Lien vers la récurrence qui a prévu ce revenu, + date d'échéance d'origine (clé anti-doublon). */
  recurringId?: ID;
  occurrenceDate?: ISODate;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseStatus = 'realisee' | 'prevue' | 'annulee';
export type Nature = 'fixe' | 'variable';

/** Remboursement rattaché à une dépense : il réduit la dépense (jamais compté comme revenu). */
export interface Refund {
  id: ID;
  amount: Cents;
  date: ISODate;
  note?: string;
}

export interface Expense {
  id: ID;
  amount: Cents;
  date: ISODate;
  categoryId: ID;
  description: string;
  nature: Nature;
  status: ExpenseStatus;
  note?: string;
  refunds: Refund[];
  /**
   * Revenu du même mois auquel la dépense est rattachée (suivi uniquement).
   * Absent = « dépense générale du mois ». N'influence jamais les totaux.
   */
  incomeId?: ID;
  recurringId?: ID;
  occurrenceDate?: ISODate;
  createdAt: string;
  updatedAt: string;
}

export type Frequency = 'hebdomadaire' | 'mensuel' | 'trimestriel' | 'annuel';

export interface RecurringTransaction {
  id: ID;
  kind: 'income' | 'expense';
  amount: Cents;
  description: string;
  categoryId?: ID; // dépenses
  incomeType?: IncomeType; // revenus
  nature: Nature;
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate;
  active: boolean;
  /** Échéances volontairement ignorées (ex. mois sans loyer). */
  skipped: ISODate[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: ID;
  name: string;
  icon: string;
  custom: boolean;
  archived: boolean;
}

/** Catégorie budgétée d'un mois (limite). */
export interface BudgetCategory {
  categoryId: ID;
  limit: Cents;
}

export interface CarryOver {
  /** Montant signé en centimes : positif = surplus reporté, négatif = déficit reporté. */
  amount: number;
  fromPeriod: PeriodKey;
  recordedAt: string;
}

export interface Budget {
  period: PeriodKey;
  categories: BudgetCategory[];
  savingsTarget: Cents;
  carryOver?: CarryOver;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: ID;
  name: string;
  icon: string;
  target: Cents;
  targetDate?: ISODate;
  paused: boolean;
  reachedAt?: ISODate;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 'versement' | 'retrait' | 'transfert';

/**
 * Mouvement d'épargne = TRANSFERT INTERNE.
 * - versement : compte courant -> objectif
 * - retrait : objectif -> compte courant
 * - transfert : objectif (goalId) -> objectif (toGoalId), neutre pour le disponible
 */
export interface SavingsMovement {
  id: ID;
  goalId: ID;
  type: MovementType;
  amount: Cents;
  date: ISODate;
  toGoalId?: ID;
  note?: string;
  createdAt: string;
}

export type XpRule = 'saisie' | 'budget' | 'bilan' | 'revue' | 'epargne' | 'mission';

export interface XpEvent {
  id: ID;
  rule: XpRule;
  /** Clé de déduplication : une même clé ne rapporte de l'XP qu'une seule fois. */
  key: string;
  xp: number;
  date: ISODate;
  label: string;
}

export interface MissionCompletion {
  missionId: string;
  period: string; // période ou 'once'
  date: ISODate;
}

export interface Equipment {
  hat?: string;
  scarf: string;
  accessory?: string;
}

export interface UserProgress {
  xpEvents: XpEvent[];
  achievements: Record<string, ISODate>;
  unlockedRegions: Record<string, ISODate>;
  missionCompletions: MissionCompletion[];
  bilansViewed: PeriodKey[];
  recurringReviews: PeriodKey[];
  categoryChallenge?: { period: PeriodKey; categoryId: ID; limit: Cents };
  equipped: Equipment;
}

export type Theme = 'auto' | 'clair' | 'sombre';

export interface AppSettings {
  nickname: string;
  /** Compagnon choisi au premier lancement (absent = écran de choix). */
  mascot?: MascotId;
  currency: string;
  monthStartDay: number; // 1..28
  theme: Theme;
  animations: boolean;
  alerts: { budget: boolean; echeances: boolean; rappelSaisie: boolean; masquerMontants: boolean };
  /** Solde de départ facultatif, ajouté explicitement au disponible d'un mois donné. */
  openingBalance?: { amount: number; period: PeriodKey };
  xpRules: Record<XpRule, number>;
  activeMissions: string[];
  lastBackupAt?: string;
  onboardingDone: boolean;
}

export interface AppData {
  schemaVersion: number;
  incomes: Income[];
  expenses: Expense[];
  recurring: RecurringTransaction[];
  categories: Category[];
  budgets: Record<PeriodKey, Budget>;
  goals: SavingsGoal[];
  movements: SavingsMovement[];
  progress: UserProgress;
  settings: AppSettings;
  envelopes: EnvelopeData;
  createdAt: string;
}

export interface DateRange {
  start: ISODate;
  end: ISODate; // inclus
}

/* ----- Définitions statiques (jeu) ----- */

export interface Mission {
  id: string;
  title: string;
  description: string;
  xp: number;
  repeat: 'once' | 'period';
  optional: boolean;
  region: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface CosmeticItem {
  id: string;
  slot: 'hat' | 'scarf' | 'accessory';
  name: string;
  level: number;
}

export type MascotId = 'chat' | 'loutre' | 'lion' | 'renard';

/* ----- Méthode des enveloppes (voir src/domain/envelopes.ts) ----- */

/** Clé d'enveloppe : 'laser' et 'epargne' (permanentes), ou `${mois}:w1`…`${mois}:w4`, `${mois}:divers`. */
export type EnvelopeKey = string;

export interface FixedCharge {
  id: ID;
  name: string;
  amount: Cents;
}

/** Plan d'un mois : salaire, dépenses fixes, épargne et budget hebdomadaire. */
export interface EnvelopeMonth {
  period: PeriodKey;
  salary: Cents;
  fixed: FixedCharge[];
  savings: Cents;
  weekly: Cents;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mouvement d'enveloppe. `amount` toujours positif.
 * depense : sort de `from` · ajout : entre dans `to` · transfert : `from` → `to` (neutre)
 * correction : ajustement manuel (from OU to) · seance : vide l'enveloppe laser (séance payée).
 */
export interface EnvelopeTx {
  id: ID;
  date: ISODate;
  kind: 'depense' | 'ajout' | 'transfert' | 'correction' | 'seance';
  from?: EnvelopeKey;
  to?: EnvelopeKey;
  amount: Cents;
  note?: string;
  createdAt: string;
}

export interface EnvelopeData {
  months: Record<PeriodKey, EnvelopeMonth>;
  tx: EnvelopeTx[];
  laserTarget: Cents;
}
