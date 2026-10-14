/**
 * Loans and card EMIs (equal monthly instalments), worked out the way banks usually do it:
 * a reducing balance with interest charged monthly at a twelfth of the yearly rate.
 * Lenders round and count days slightly differently, so figures can be a little off the statement.
 */
import { addMonthsDate, iso, parse, THIS_MONTH, TODAY } from './dates'
import type { Emi, Rule, State } from './types'

const r2 = (v: number) => Math.round(v * 100) / 100

/** The monthly instalment for borrowing `principal` at `rate`% a year over `months` months. */
export function emiAmount(principal: number, rate: number, months: number) {
  if (!(principal > 0) || !(months > 0)) return 0
  const r = rate / 1200
  if (!r) return r2(principal / months)
  const f = (1 + r) ** months
  return r2((principal * r * f) / (f - 1))
}

/** Balance still owed after `k` instalments of `emi`. */
export function balanceAfter(principal: number, rate: number, emi: number, k: number) {
  const r = rate / 1200
  const b = r ? principal * (1 + r) ** k - (emi * ((1 + r) ** k - 1)) / r : principal - emi * k
  return Math.max(0, r2(b))
}

/** Date of instalment number `n` (1 = the first). */
export const instalmentDate = (e: Pick<Emi, 'first'>, n: number) => iso(addMonthsDate(parse(e.first), n - 1))

export interface EmiStatus {
  emi: number
  /** instalments paid before today */
  done: number
  left: number
  /** the instalment number falling in this calendar month, if any */
  thisMonth: { n: number; date: string; paid: boolean } | null
  next: { n: number; date: string } | null
  last: string
  owed: number
  interestPaid: number
  interestTotal: number
  totalPayable: number
  phase: 'not started' | 'running' | 'closed'
}

/** Where a loan or card EMI stands today. An instalment due today counts as still to pay. */
export function emiStatus(e: Emi, today = TODAY): EmiStatus {
  const emi = e.emi && e.emi > 0 ? e.emi : emiAmount(e.principal, e.rate, e.months)
  let done = 0
  while (done < e.months && instalmentDate(e, done + 1) < today) done++
  const left = e.months - done
  const last = instalmentDate(e, e.months)
  let thisMonth: EmiStatus['thisMonth'] = null
  for (let n = 1; n <= e.months; n++) {
    const d = instalmentDate(e, n)
    if (d.slice(0, 7) === THIS_MONTH) { thisMonth = { n, date: d, paid: d < today }; break }
    if (d.slice(0, 7) > THIS_MONTH) break
  }
  const owed = done >= e.months ? 0 : balanceAfter(e.principal, e.rate, emi, done)
  const totalPayable = r2(emi * e.months)
  return {
    emi, done, left, thisMonth, last, owed,
    next: left ? { n: done + 1, date: instalmentDate(e, done + 1) } : null,
    interestPaid: Math.max(0, r2(emi * done - (e.principal - owed))),
    interestTotal: Math.max(0, r2(totalPayable - e.principal)),
    totalPayable,
    phase: done === 0 ? 'not started' : left ? 'running' : 'closed',
  }
}

/** Every instalment: date, how much goes to interest and to the loan, and what is owed after. */
export function emiSchedule(e: Emi) {
  const emi = e.emi && e.emi > 0 ? e.emi : emiAmount(e.principal, e.rate, e.months)
  const r = e.rate / 1200
  let bal = e.principal
  return Array.from({ length: e.months }, (_, i) => {
    const interest = r2(bal * r)
    const isLast = i === e.months - 1
    const pay = isLast ? r2(bal + interest) : emi
    const principal = r2(pay - interest)
    bal = isLast ? 0 : Math.max(0, r2(bal - principal))
    return { n: i + 1, date: instalmentDate(e, i + 1), pay, interest, principal, balance: bal }
  })
}

/**
 * The regular item that puts instalments on the calendar. It starts at the first instalment on or
 * after `from`, so instalments paid before you started using SpendCop aren't added as past spending.
 */
export function emiRule(e: Emi, from: string, existing?: Rule, cat = 'debt'): Rule | null {
  const st = emiStatus(e, from)
  if (!st.next) return null
  return {
    ...(existing ?? {}), id: existing?.id ?? e.ruleId ?? Math.random().toString(36).slice(2, 10),
    name: `${e.name} EMI`, type: 'expense', cat, amount: st.emi, freq: 'monthly',
    start: st.next.date, end: st.last, account: e.account,
  }
}

/** Everything still owed on loans and card EMIs today. */
export const emisOwed = (s: State) => (s.emis ?? []).reduce((a, e) => a + emiStatus(e).owed, 0)
