/**
 * The summary of your dashboard that Ask SpendCop reads. Built from the same numbers the screens
 * show, so the AI explains SpendCop's own calculations rather than redoing them. It is small (a
 * few thousand words at most), which keeps answers quick, and you can see it in full in Settings.
 */
import {
  accountName, balances, catName, duplicateIds, goalStatus, health, itemsIn, monthPicture, monthStats, perMonth,
  planFor, simulate, spendCats, sum, tips, tripStats, upcoming, worthNow, FREQ,
} from '../calc'
import { addDays, addMonths, iso, NOW, THIS_MONTH, TODAY } from '../dates'
import type { State } from '../types'
import { emiStatus } from '../emi'

const r = (v: number) => Math.round((v || 0) * 100) / 100
const kind = (t: string) => (t === 'income' ? 'in' : t === 'savings' ? 'put aside' : 'out')

export interface ContextOptions { recent?: number; notes?: boolean }

export function buildContext(s: State, o: ContextOptions = {}) {
  const recentN = o.recent ?? 40, notes = o.notes ?? true
  const P = monthPicture(s, THIS_MONTH), m = P.m
  const H = health(s, THIS_MONTH)
  const bal = balances(s)
  const w = worthNow(s)
  const sim = simulate(s.debts, s.settings.extra, s.settings.strategy)
  const months = Array.from({ length: 12 }, (_, i) => addMonths(THIS_MONTH, i - 11))
  const prev3 = [1, 2, 3].map((i) => monthStats(s, addMonths(THIS_MONTH, -i)))
  const recent = itemsIn(s, iso(addDays(NOW, -120)), TODAY).filter((t) => t.paid).sort((a, b) => b.date.localeCompare(a.date)).slice(0, recentN)
  const tripName = (id?: string) => (id ? s.trips?.find((t) => t.id === id)?.name : undefined)

  return {
    today: TODAY,
    currency: s.settings.currency,
    people: s.people,
    exampleData: s.sample || undefined,
    thisMonth: {
      month: THIS_MONTH,
      daysLeft: P.daysLeft,
      moneyIn: r(m.income), expectedStillToCome: r(m.expectedIn),
      spent: r(m.spent), putAside: r(m.saved), billsStillToPay: r(m.billsDue),
      safeToSpend: r(P.safe), safePerDay: r(P.perDay),
      plan: r(P.plan), forecastMonthEndSpending: r(P.forecast),
      byGroup: { essentials: r(m.byGroup.essentials), extras: r(m.byGroup.extras), future: r(m.byGroup.future) },
      healthyBalanceTarget: { essentials: s.settings.ratios[0], extras: s.settings.ratios[1], savings: s.settings.ratios[2], unit: '% of money in' },
    },
    health: { score: H.score, label: H.label, checks: H.checks.map((c) => ({ title: c.title, points: c.points, outOf: c.max, detail: c.detail })) },
    tips: tips(s, THIS_MONTH).map((t) => t.text),
    categoriesThisMonth: spendCats(s).map((c) => {
      const spent = m.byCat[c.id] || 0, plan = planFor(s, c, THIS_MONTH)
      return { name: c.name, group: c.group, plan: r(plan), spent: r(spent), usualMonth: r(sum(prev3.map((x) => x.byCat[c.id] || 0)) / 3) }
    }).filter((c) => c.plan || c.spent || c.usualMonth),
    last12Months: months.map((k) => { const x = monthStats(s, k); return { month: k, in: r(x.income), out: r(x.spent), putAside: r(x.saved) } }),
    billsNext14Days: upcoming(s, 14).map((t) => ({ date: t.date, name: t.note, amount: r(t.amount) })),
    regularItems: s.rules.map((x) => ({ name: x.name, type: kind(x.type), category: catName(s, x.cat), amount: r(x.amount), how: FREQ[x.freq].label, perMonth: r(perMonth(x)), ends: x.end || undefined })),
    accounts: s.accounts.map((a) => ({ name: a.name, type: a.type, balance: r(bal[a.id] || 0) })),
    netWorth: { own: r(w.own), owe: r(w.owe), worth: r(w.own - w.owe) },
    goals: s.goals.map((g) => { const st = goalStatus(g); return { name: g.name, target: r(g.target), saved: r(g.saved), due: g.due, status: st.state, neededPerMonth: r(st.need), recentPacePerMonth: r(st.pace), likelyDone: st.eta ? iso(st.eta) : undefined } }),
    debts: s.debts.length ? {
      list: s.debts.map((d) => ({ name: d.name, balance: r(d.balance), interestRate: d.rate, minimum: r(d.min), paidOffInMonths: sim.payoff[d.id], interestStillToPay: r(sim.per[d.id]?.interest ?? 0) })),
      plan: { strategy: s.settings.strategy, extraPerMonth: r(s.settings.extra), debtFreeInMonths: sim.stuck ? 'never at this rate' : sim.months, totalInterest: r(sim.interest) },
    } : undefined,
    loansAndEmis: (s.emis ?? []).length ? (s.emis ?? []).map((e) => { const st = emiStatus(e); return { name: e.name, kind: e.kind === 'card' ? 'card EMI' : 'loan', borrowed: r(e.principal), interestRate: e.rate, months: e.months, emi: st.emi, paid: st.done, left: st.left, thisMonth: st.thisMonth ? `EMI ${st.thisMonth.n} of ${e.months} on ${st.thisMonth.date}${st.thisMonth.paid ? ' (paid)' : ''}` : undefined, stillOwed: r(st.owed), lastEmi: st.last, interestStillToPay: r(st.interestTotal - st.interestPaid) } }) : undefined,
    trips: (s.trips ?? []).map((t) => { const st = tripStats(s, t); return { name: t.name, from: t.start, to: t.end, phase: st.phase, budget: r(t.budget), spent: r(st.net), leftInBudget: t.budget ? r(st.left) : undefined, perDayLeft: st.perDayLeft ? r(st.perDayLeft) : undefined, topCategories: st.byCat.slice(0, 3).map(([c, v]) => ({ category: catName(s, c), amount: r(v) })) } }),
    possibleDuplicates: duplicateIds(s).size || undefined,
    recentEntries: recent.map((t) => ({
      date: t.date, type: kind(t.type), category: catName(s, t.cat), sub: t.sub || undefined, amount: r(t.amount),
      ...(notes && t.note ? { description: t.note.slice(0, 60) } : {}),
      ...(s.people.length > 1 && t.person ? { who: t.person } : {}),
      account: accountName(s, t.account) || undefined, trip: tripName(t.trip), regular: t.virtual || undefined,
    })),
  }
}

/** The exact text sent to the AI. */
export const contextText = (s: State, o?: ContextOptions) => JSON.stringify(buildContext(s, o))
