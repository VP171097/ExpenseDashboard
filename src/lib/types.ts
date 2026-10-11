export type Kind = 'expense' | 'income' | 'savings'
/** Plain-language buckets: essentials (needs), extras (wants), future you (savings). */
export type Group = 'essentials' | 'extras' | 'future'
export type Freq = 'weekly' | 'biweekly' | 'fourweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export interface Category { id: string; name: string; kind: Kind; group: Group; plan: number; slot: number | null; icon: string }
export interface Account { id: string; name: string; type: 'everyday' | 'savings' | 'card' | 'cash' | 'investment'; start: number }
export interface Tx { id: string; date: string; type: Kind; cat: string; amount: number; account: string; to?: string; person?: string; note: string }
export interface Rule {
  id: string; name: string; type: Kind; cat: string; amount: number; freq: Freq; start: string; end?: string
  account: string; to?: string; person?: string; paidThrough?: string
}
export interface Goal { id: string; name: string; target: number; saved: number; due: string }
export interface Debt { id: string; name: string; balance: number; rate: number; min: number }
export interface Holding { id: string; name: string; kind: 'own' | 'owe'; group: string; value: number }

export interface Settings {
  name: string
  currency: string
  ratios: [number, number, number]
  rollover: boolean
  weekStart: number
  payCycle: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
  challengeTarget: number
  extra: number
  strategy: 'cheapest' | 'quickwins'
  forecast: { monthly: number; rate: number; years: number }
  theme: 'system' | 'light' | 'dark'
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
  holdings: Holding[]
  history: Record<string, { own: number; owe: number }>
  settings: Settings
}

/** A transaction as shown in lists: real entries plus generated bill occurrences. */
export interface Item extends Tx { paid: boolean; ruleId?: string; virtual?: boolean }
