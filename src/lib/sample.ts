import { addDays, addMonths, addMonthsDate, iso, NOW, pad, parse, THIS_MONTH, TODAY } from './dates'
import { uid } from './calc'
import type { Category, Freq, Rule, Settings, State, Transfer, Tx } from './types'

export function baseCategories(): Category[] {
  return [
    { id: 'housing', name: 'Home', kind: 'expense', group: 'essentials', plan: 1650, slot: 0, icon: 'home' },
    { id: 'groceries', name: 'Groceries', kind: 'expense', group: 'essentials', plan: 560, slot: 1, icon: 'cart', subs: ['Supermarket', 'Market', 'Bakery'] },
    { id: 'dining', name: 'Eating out', kind: 'expense', group: 'extras', plan: 240, slot: 2, icon: 'food', subs: ['Restaurants', 'Coffee', 'Takeaway'] },
    { id: 'transport', name: 'Getting around', kind: 'expense', group: 'essentials', plan: 260, slot: 3, icon: 'car', subs: ['Fuel', 'Public transport', 'Parking', 'Car upkeep'] },
    { id: 'utilities', name: 'Energy & phone', kind: 'expense', group: 'essentials', plan: 210, slot: 4, icon: 'bolt' },
    { id: 'subs', name: 'Subscriptions', kind: 'expense', group: 'extras', plan: 75, slot: 5, icon: 'tv' },
    { id: 'shopping', name: 'Shopping', kind: 'expense', group: 'extras', plan: 220, slot: 6, icon: 'bag', subs: ['Clothes', 'Home', 'Electronics', 'Books'] },
    { id: 'debt', name: 'Loan payments', kind: 'expense', group: 'essentials', plan: 470, slot: 7, icon: 'card' },
    { id: 'health', name: 'Health', kind: 'expense', group: 'essentials', plan: 90, slot: null, icon: 'heart' },
    { id: 'fun', name: 'Fun & hobbies', kind: 'expense', group: 'extras', plan: 110, slot: null, icon: 'ticket' },
    { id: 'travel', name: 'Trips', kind: 'expense', group: 'extras', plan: 150, slot: null, icon: 'plane' },
    { id: 'gifts', name: 'Gifts', kind: 'expense', group: 'extras', plan: 50, slot: null, icon: 'gift' },
    { id: 'other', name: 'Other', kind: 'expense', group: 'extras', plan: 0, slot: null, icon: 'box' },
    { id: 'salary', name: 'Pay', kind: 'income', group: 'essentials', plan: 0, slot: null, icon: 'briefcase' },
    { id: 'side', name: 'Side income', kind: 'income', group: 'essentials', plan: 0, slot: null, icon: 'sparkles' },
    { id: 'otherin', name: 'Other money in', kind: 'income', group: 'essentials', plan: 0, slot: null, icon: 'coins' },
    { id: 'savings', name: 'Savings', kind: 'savings', group: 'future', plan: 0, slot: null, icon: 'piggy' },
    { id: 'invest', name: 'Investing', kind: 'savings', group: 'future', plan: 0, slot: null, icon: 'growth' },
  ]
}
export function baseSettings(): Settings {
  return {
    name: '', currency: 'EUR', ratios: [50, 30, 20], rollover: false, weekStart: 1, payCycle: 'monthly', challengeTarget: 12,
    extra: 150, strategy: 'cheapest', forecast: { monthly: 400, rate: 6, years: 15 }, theme: 'system', payAnchor: TODAY, payDays: 14,
  }
}
export function emptyState(currency = 'EUR'): State {
  return {
    v: 2, sample: false, people: ['Me'],
    accounts: [
      { id: 'chk', name: 'Everyday account', type: 'everyday', start: 0 },
      { id: 'sav', name: 'Savings account', type: 'savings', start: 0 },
    ],
    categories: baseCategories(), tx: [], rules: [], paid: {}, skip: {}, goals: [], debts: [], holdings: [], history: {}, transfers: [], overrides: {}, reflections: {},
    settings: { ...baseSettings(), currency },
  }
}

function rng(seed: number) {
  let a = seed
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** A realistic year for a two-person household, ending today. */
export function sampleState(): State {
  const r = rng(20261011)
  const R = (a: number, b: number) => Math.round((a + r() * (b - a)) * 100) / 100
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const s0 = addMonths(THIS_MONTH, -12)
  const people = ['Alex', 'Sam']
  const rule = (name: string, type: Rule['type'], cat: string, amount: number, freq: Freq, day: number, person: string, to = ''): Rule =>
    ({ id: uid(), name, type, cat, amount, freq, start: `${s0}-${pad(day)}`, account: 'chk', to, person, paidThrough: TODAY })
  let fri = parse(s0 + '-01'); while (fri.getDay() !== 5) fri = addDays(fri, 1)
  const rules: Rule[] = [
    rule('Alex pay', 'income', 'salary', 3400, 'monthly', 25, 'Alex'),
    { ...rule('Sam pay', 'income', 'salary', 1260, 'biweekly', 1, 'Sam'), start: iso(fri) },
    rule('Rent', 'expense', 'housing', 1650, 'monthly', 1, 'Alex'),
    rule('Electricity & gas', 'expense', 'utilities', 96, 'monthly', 12, 'Sam'),
    rule('Home internet', 'expense', 'utilities', 45, 'monthly', 18, 'Alex'),
    rule('Phone plans', 'expense', 'utilities', 58, 'monthly', 21, 'Sam'),
    rule('Netflix', 'expense', 'subs', 15.99, 'monthly', 8, 'Sam'),
    rule('Spotify', 'expense', 'subs', 14.99, 'monthly', 14, 'Alex'),
    rule('Gym', 'expense', 'subs', 39, 'monthly', 3, 'Alex'),
    rule('Cloud storage', 'expense', 'subs', 29.99, 'yearly', 19, 'Alex'),
    rule('Car insurance', 'expense', 'transport', 186, 'quarterly', 9, 'Sam'),
    rule('Car loan', 'expense', 'debt', 260, 'monthly', 5, 'Sam'),
    rule('Student loan', 'expense', 'debt', 160, 'monthly', 10, 'Alex'),
    rule('Store card', 'expense', 'debt', 45, 'monthly', 16, 'Sam'),
    rule('Move to savings', 'savings', 'savings', 1500, 'monthly', 26, 'Alex', 'sav'),
    rule('Investing plan', 'savings', 'invest', 500, 'monthly', 27, 'Sam'),
  ]
  /* note -> sub-category */
  const notes: Record<string, string[]> = {
    groceries: ['Weekly shop|Supermarket', 'Supermarket|Supermarket', 'Farmers market|Market', 'Corner bakery|Bakery', 'Butcher|Market'],
    dining: ['Pizza night|Restaurants', 'Coffee & cake|Coffee', 'Sushi|Restaurants', 'Brunch|Restaurants', 'Takeaway curry|Takeaway', 'Flat white|Coffee'],
    transport: ['Fuel|Fuel', 'Train tickets|Public transport', 'Parking|Parking', 'Bike repair|Car upkeep', 'Bus pass|Public transport'],
    shopping: ['Clothes|Clothes', 'Home bits|Home', 'Books|Books', 'Headphones|Electronics', 'Kitchen stuff|Home'],
    health: ['Pharmacy', 'Dentist', 'Physio'],
    fun: ['Cinema', 'Concert', 'Board game café', 'Museum'],
    travel: ['Weekend away', 'Hotel', 'Flights'],
    gifts: ['Birthday present', 'Flowers'],
    side: ['Design job', 'Sold old bike'],
    otherin: ['Tax refund', 'Cashback'],
  }
  const tx: Tx[] = []
  const add = (date: string, type: Tx['type'], cat: string, amount: number) => {
    const [note, sub] = pick(notes[cat] ?? ['Purchase']).split('|')
    const account = cat === 'shopping' || (cat === 'dining' && r() < 0.5) ? 'cc' : 'chk'
    tx.push({ id: uid(), date, type, cat, amount, account, person: pick(people), note, ...(sub ? { sub } : {}) })
  }
  const transfers: Transfer[] = []
  for (let d = parse(s0 + '-01'); iso(d) <= TODAY; d = addDays(d, 1)) {
    const ds = iso(d), mo = d.getMonth(), wk = d.getDay() === 0 || d.getDay() === 6, dec = mo === 11, summer = mo >= 5 && mo <= 7
    if (r() < 0.3) add(ds, 'expense', 'groceries', R(16, 96))
    if (r() < (wk ? 0.42 : 0.12)) add(ds, 'expense', 'dining', R(11, 64))
    if (r() < 0.13) add(ds, 'expense', 'transport', R(8, 62))
    if (r() < (dec ? 0.2 : 0.065)) add(ds, 'expense', 'shopping', R(14, 135))
    if (r() < 0.03) add(ds, 'expense', 'health', R(9, 85))
    if (r() < (wk ? 0.12 : 0.03)) add(ds, 'expense', 'fun', R(10, 58))
    if (r() < (summer ? 0.035 : 0.008)) add(ds, 'expense', 'travel', R(90, 420))
    if (r() < (dec ? 0.12 : 0.012)) add(ds, 'expense', 'gifts', R(15, 80))
    if (r() < 0.018) add(ds, 'income', 'side', R(180, 640))
    if (r() < 0.005) add(ds, 'income', 'otherin', R(25, 160))
  }
  // pay the credit card off from the everyday account each month
  for (let i = 12; i >= 1; i--) {
    const k = addMonths(THIS_MONTH, -i)
    const owed = tx.filter((t) => t.account === 'cc' && t.date.startsWith(k)).reduce((a, t) => a + t.amount, 0)
    if (owed > 0) transfers.push({ id: uid(), date: `${addMonths(k, 1)}-04`, from: 'chk', to: 'cc', amount: Math.round(owed * 100) / 100, note: 'Credit card payment' })
  }
  const due = (n: number) => iso(addMonthsDate(NOW, n))
  const st: State = {
    v: 2, sample: true, people,
    accounts: [
      { id: 'chk', name: 'Everyday account', type: 'everyday', start: 600 },
      { id: 'sav', name: 'Savings account', type: 'savings', start: 5200 },
      { id: 'cc', name: 'Credit card', type: 'card', start: -320 },
    ],
    categories: baseCategories(), tx, rules, paid: {}, skip: {},
    goals: [
      { id: uid(), name: 'Rainy day fund', target: 12000, saved: 7450, due: due(10) },
      { id: uid(), name: 'Summer trip to Porto', target: 2400, saved: 1380, due: due(8) },
      { id: uid(), name: 'New laptop', target: 1600, saved: 1600, due: due(1) },
      { id: uid(), name: "Mia's wedding gift", target: 300, saved: 80, due: due(1) },
    ],
    debts: [
      { id: uid(), name: 'Car loan', balance: 9800, rate: 6.9, min: 260 },
      { id: uid(), name: 'Student loan', balance: 14200, rate: 4.5, min: 160 },
      { id: uid(), name: 'Store card', balance: 1350, rate: 24.9, min: 45 },
    ],
    holdings: [
      { id: uid(), name: 'Investments', kind: 'own', group: 'Investments', value: 18400 },
      { id: uid(), name: 'Work pension', kind: 'own', group: 'Investments', value: 23900 },
      { id: uid(), name: 'Car', kind: 'own', group: 'Things', value: 11500 },
      { id: uid(), name: 'Loan from family', kind: 'owe', group: 'Personal', value: 600 },
    ],
    history: {}, transfers, overrides: {}, reflections: {},
    settings: { ...baseSettings(), name: 'Alex', payAnchor: `${s0}-25` },
  }
  return st
}

/** Fake a gently rising 12-month history so the trend chart has something to show. */
export function seedHistory(s: State, now: { own: number; owe: number }) {
  const r = rng(99)
  for (let i = 12; i >= 1; i--)
    s.history[addMonths(THIS_MONTH, -i)] = { own: Math.round(now.own - i * 2350 + (r() - 0.5) * 900), owe: Math.round(now.owe + i * 455) }
}
