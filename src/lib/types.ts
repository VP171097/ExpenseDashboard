export type Kind = 'expense' | 'income' | 'savings'
/** Plain-language buckets: essentials (needs), extras (wants), future you (savings). */
export type Group = 'essentials' | 'extras' | 'future'
export type Freq = 'weekly' | 'biweekly' | 'fourweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export interface Category { id: string; name: string; kind: Kind; group: Group; plan: number; slot: number | null; icon: string; subs?: string[] }
export interface Account { id: string; name: string; type: 'everyday' | 'savings' | 'card' | 'cash' | 'investment'; start: number }
export interface Tx { id: string; date: string; type: Kind; cat: string; sub?: string; amount: number; account: string; to?: string; person?: string; note: string; /** the trip or holiday this belongs to */ trip?: string }
/** A trip or holiday. Its spending is ordinary entries tagged with the trip, so it still counts in every month and plan. */
export interface Trip { id: string; name: string; icon: string; start: string; end: string; budget: number; note?: string }
/** Money moved between your own accounts, e.g. paying off the credit card. Not spending. */
export interface Transfer { id: string; date: string; from: string; to: string; amount: number; note: string }
export interface Rule {
  id: string; name: string; type: Kind; cat: string; amount: number; freq: Freq; start: string; end?: string
  account: string; to?: string; person?: string; paidThrough?: string; sub?: string
  /** a monthly item that lands on payday (see Settings.payday) instead of a fixed date */
  payday?: boolean
}
export interface Goal { id: string; name: string; target: number; saved: number; due: string; history?: { date: string; amount: number }[] }
export interface Debt { id: string; name: string; balance: number; rate: number; min: number; order?: number }
/** A loan or a card purchase turned into EMIs (equal monthly instalments). */
export interface Emi {
  id: string; name: string; kind: 'loan' | 'card'; lender?: string
  /** amount borrowed */
  principal: number
  /** interest per year, in % */
  rate: number
  /** number of monthly instalments */
  months: number
  /** date of the first instalment */
  first: string
  /** the instalment from the lender's statement, when it differs from the worked-out one */
  emi?: number
  account: string
  /** the regular item that puts each instalment on the calendar */
  ruleId?: string
}
/** How the monthly payday is found: a fixed date, or the first or last working day of the month. */
export interface Payday { rule: 'date' | 'first' | 'last'; day: number; shift: 'before' | 'after' }
export interface Holding { id: string; name: string; kind: 'own' | 'owe'; group: string; value: number }

export interface Settings {
  name: string
  currency: string
  ratios: [number, number, number]
  rollover: boolean
  weekStart: number
  payCycle: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'custom'
  /** A known payday, used to line up pay periods. */
  payAnchor: string
  /** Length of a custom pay period in days. */
  payDays: number
  challengeTarget: number
  extra: number
  strategy: 'cheapest' | 'quickwins' | 'custom'
  forecast: { monthly: number; rate: number; years: number }
  theme: 'system' | 'light' | 'dark'
  /** set once the light-by-default change has been applied */
  themeV?: number
  /** monthly payday rule */
  payday?: Payday
  /** days of the week you don't work (0 = Sunday) */
  offDays?: number[]
  /** the day you started using Tally; nothing before it is counted */
  since?: string
  /** 'reduced' turns off 3D, tilt, particles and confetti */
  effects?: 'full' | 'reduced'
  /** when the last full backup was exported (ISO date) */
  lastBackup?: string
}

export interface State {
  v: 2
  sample: boolean
  people: string[]
  accounts: Account[]
  categories: Category[]
  tx: Tx[]
  rules: Rule[]
  paid: Record<string, boolean>
  skip: Record<string, boolean>
  goals: Goal[]
  debts: Debt[]
  emis: Emi[]
  holdings: Holding[]
  history: Record<string, { own: number; owe: number }>
  transfers: Transfer[]
  trips: Trip[]
  /** One-off changes to a single occurrence of a regular item, keyed by rule id + original date. */
  overrides: Record<string, { amount?: number; date?: string }>
  /** Year-end notes, keyed by year. */
  reflections: Record<string, string>
  /** The tour has been seen. */
  toured?: boolean
  settings: Settings
}

/** A transaction as shown in lists: real entries plus generated bill occurrences. */
export interface Item extends Tx { paid: boolean; ruleId?: string; virtual?: boolean; /** original scheduled date of a regular item */ occ?: string; changed?: boolean }
