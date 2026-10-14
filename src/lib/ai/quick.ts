/**
 * Built-in answers: the common money questions, answered instantly on this device from Tally's
 * own calculations. No AI, no network, nothing leaves the device. Questions it can't answer
 * return null, and the caller can hand them to an AI if one is connected.
 */
import {
  catOf, currentTrip, goalStatus, health, monthPicture, monthStats, perMonth, planFor, simulate, spendCats, sum, tripStats, upcoming, worthNow,
} from '../calc'
import { addMonths, fmtDate, iso, THIS_MONTH } from '../dates'
import { money, money0, pct } from '../money'
import type { State } from '../types'

export interface QuickAnswer { text: string; topic: string }

/** "₹1,200", "1.2k", "45", "2 lakh" → a number. */
export function amountIn(q: string): number | null {
  const m = q.match(/(?:₹|rs\.?|inr|€|eur|\$|usd|£|gbp)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|lakhs|m|million)?\b/i)
  if (!m) return null
  let v = parseFloat(m[1].replace(/,/g, ''))
  if (!isFinite(v)) return null
  const u = (m[2] || '').toLowerCase()
  if (u === 'k' || u === 'thousand') v *= 1e3
  else if (u.startsWith('la')) v *= 1e5
  else if (u === 'm' || u === 'million') v *= 1e6
  return v
}
const has = (q: string, re: RegExp) => re.test(q)
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length > 2)
/** The item in `list` whose name shares the most words with the question. */
function best<T>(q: string, list: T[], name: (t: T) => string): T | null {
  const qw = new Set(words(q))
  let top: T | null = null, score = 0
  for (const t of list) { const n = words(name(t)).filter((w) => qw.has(w)).length; if (n > score) { score = n; top = t } }
  return top
}

export function answerLocally(s: State, question: string): QuickAnswer | null {
  const q = question.toLowerCase().trim()
  if (!q) return null
  const P = monthPicture(s, THIS_MONTH), m = P.m
  const cur = (v: number) => `**${money0(v)}**`

  // ---- can I afford / spend X ----
  const amt = amountIn(q)
  if (amt != null && has(q, /afford|can i (spend|buy|get|pay|go|have)|is it ok|okay to (spend|buy)|should i (buy|spend)|spend .* on|buy/)) {
    const safe = P.safe, per = P.perDay, days = P.daysLeft
    if (safe <= 0) return { topic: 'afford', text: `Not right now. You have nothing free to spend this month after bills and savings (safe to spend is ${cur(safe)}). Spending ${cur(amt)} would come out of your savings or next month.` }
    if (amt <= per) return { topic: 'afford', text: `Yes. ${cur(amt)} is within today's safe amount of ${cur(per)}.\n\nAfterwards you'd still have about ${cur((safe - amt) / Math.max(1, days))} a day for the ${days} day${days === 1 ? '' : 's'} left this month, with your bills and savings already set aside.` }
    if (amt <= safe) return { topic: 'afford', text: `Yes, but it's more than today's ${cur(per)}. Spending ${cur(amt)} leaves ${cur(safe - amt)} for the rest of the month, about ${cur((safe - amt) / Math.max(1, days))} a day for ${days} day${days === 1 ? '' : 's'}.\n\n- If that feels tight, wait a few days or trim an extra.` }
    return { topic: 'afford', text: `Not comfortably. ${cur(amt)} is more than the ${cur(safe)} free this month, so ${cur(amt - safe)} would come out of your savings or bill money.\n\n- Waiting until payday, or saving towards it as a goal, keeps your plan on track.` }
  }

  // ---- health score ----
  if (has(q, /health|score|how am i doing|how('s| is) my money|doing well/)) {
    const H = health(s, THIS_MONTH)
    const weakest = [...H.checks].sort((a, b) => a.points / a.max - b.points / b.max)[0]
    const lines = H.checks.map((c) => `- **${c.points} of ${c.max}**: ${c.title}. ${c.detail}`)
    return { topic: 'health', text: `Your money health score is **${H.score}** out of 100: ${H.label.toLowerCase()}.\n\n${lines.join('\n')}${weakest && weakest.points < weakest.max ? `\n\nThe biggest lift: ${weakest.title.toLowerCase()} (${weakest.max - weakest.points} more points available).` : ''}` }
  }

  // ---- goals ----
  if (has(q, /goal|jar|saving (up )?for|save for|when (will|can) i (buy|afford|have)|reach my|be (full|done)/) && s.goals.length) {
    const g = best(q, s.goals, (x) => x.name)
    const show = g ? [g] : s.goals
    const parts = show.map((x) => {
      const st = goalStatus(x)
      if (st.state === 'done') return `- **${x.name}**: done, ${money0(x.saved)} saved.`
      const eta = st.eta ? ` At your recent pace (${money0(st.pace)} a month) it's done around **${fmtDate(iso(st.eta), { month: 'long', year: 'numeric' })}**.` : ' Nothing added in the last 3 months, so there is no finish date yet.'
      return `- **${x.name}**: ${money0(x.saved)} of ${money0(x.target)} (${pct(x.saved / x.target)}). ${money0(st.remaining)} to go; putting aside **${money0(st.need)} a month** reaches it by ${fmtDate(x.due, { month: 'long', year: 'numeric' })}.${eta}`
    })
    return { topic: 'goals', text: `${g ? '' : 'Your goals:\n\n'}${parts.join('\n')}` }
  }

  // ---- trips ----
  if (has(q, /trip|holiday|vacation|travel/) && s.trips?.length) {
    const t = best(q, s.trips, (x) => x.name) ?? currentTrip(s) ?? s.trips[s.trips.length - 1]
    const st = tripStats(s, t)
    const budget = t.budget > 0 ? ` of the ${money0(t.budget)} budget${st.left >= 0 ? `, so ${cur(st.left)} is left` : `, so you're ${cur(-st.left)} over`}` : ''
    const daily = st.phase !== 'done' && t.budget > 0 && st.left > 0 ? `\n\n- That's about ${cur(st.perDayLeft)} a day for ${st.phase === 'on' ? `the ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left` : `each of the ${st.days} days`}.` : ''
    const top = st.byCat.slice(0, 3).map(([c, v]) => `${catOf(s, c)?.name ?? 'Other'} ${money0(v)}`).join(', ')
    return { topic: 'trip', text: `**${t.name}** (${st.phase === 'on' ? `on now, day ${st.dayNo} of ${st.days}` : st.phase === 'upcoming' ? 'coming up' : 'finished'}): ${cur(st.net)} spent${budget}.${daily}${top ? `\n- Biggest costs: ${top}.` : ''}` }
  }

  // ---- debts ----
  if (has(q, /debt|loan|credit card|pay (it )?off|interest|owe/) && s.debts.length) {
    const sim = simulate(s.debts, s.settings.extra, s.settings.strategy)
    const order = [...s.debts].filter((d) => d.balance > 0).sort((a, b) => (sim.payoff[a.id] ?? 999) - (sim.payoff[b.id] ?? 999))
    const first = [...s.debts].filter((d) => d.balance > 0).sort((a, b) => b.rate - a.rate)[0]
    return { topic: 'debts', text: `Pay extra on **${first.name}** first: at ${first.rate}% it costs you the most. Keep paying the minimum on the others.\n\nWith ${money0(s.settings.extra)} extra a month, you're debt-free in about **${sim.stuck ? 'never at this rate' : `${sim.months} months`}**, paying ${money0(sim.interest)} in interest.\n\n${order.map((d) => `- ${d.name}: ${money0(d.balance)} at ${d.rate}%, paid off in ${sim.payoff[d.id] ?? '?'} months`).join('\n')}` }
  }

  // ---- overspending / cut back ----
  if (has(q, /cut back|overspend|over spend|over budget|over my plan|save money|spending too much|where .*(money|spend)|biggest|most/)) {
    const prev3 = [1, 2, 3].map((i) => monthStats(s, addMonths(THIS_MONTH, -i)))
    const rows = spendCats(s).map((c) => {
      const now = m.byCat[c.id] || 0, plan = planFor(s, c, THIS_MONTH), usual = sum(prev3.map((x) => x.byCat[c.id] || 0)) / 3
      return { c, now, plan, usual }
    })
    const over = rows.filter((r) => r.plan > 0 && r.now > r.plan).sort((a, b) => b.now - b.plan - (a.now - a.plan))
    const high = rows.filter((r) => r.usual > 20 && r.now > r.usual * 1.15 && !over.includes(r)).sort((a, b) => b.now - b.usual - (a.now - a.usual))
    const extras = rows.filter((r) => r.c.group === 'extras' && r.now > 0).sort((a, b) => b.now - a.now)
    const out: string[] = []
    over.slice(0, 3).forEach((r) => out.push(`- **${r.c.name}**: ${money0(r.now)} against a plan of ${money0(r.plan)} (${money0(r.now - r.plan)} over).`))
    high.slice(0, 2).forEach((r) => out.push(`- **${r.c.name}** is higher than usual: ${money0(r.now)} so far vs about ${money0(r.usual)} in a normal month.`))
    if (!out.length) extras.slice(0, 3).forEach((r) => out.push(`- **${r.c.name}**: ${money0(r.now)} this month.`))
    const head = over.length ? 'Here is where you are over your plan this month:' : high.length ? "You're inside your plan, but a few things are running higher than usual:" : "You're not over your plan anywhere. Your biggest extras this month are:"
    const subs = s.rules.filter((r) => r.cat === 'subs' && r.type === 'expense')
    return { topic: 'cutback', text: `${head}\n\n${out.join('\n') || '- Nothing spent on extras yet this month.'}${subs.length ? `\n\nSubscriptions add up to ${cur(sum(subs.map(perMonth)) * 12)} a year. Cancelling one you rarely use is an easy win (Bills & pay).` : ''}` }
  }

  // ---- bills ----
  if (has(q, /bill|due|upcoming|subscription|rent|what do i (have to )?pay/)) {
    const b = upcoming(s, 14)
    if (!b.length) return { topic: 'bills', text: 'No bills are due in the next two weeks. Everything due so far is ticked off.' }
    return { topic: 'bills', text: `${b.length} bill${b.length === 1 ? '' : 's'} due in the next two weeks, ${cur(sum(b.map((x) => x.amount)))} in total:\n\n${b.slice(0, 8).map((x) => `- ${fmtDate(x.date)}: ${x.note} ${money(x.amount)}`).join('\n')}${b.length > 8 ? `\n- …and ${b.length - 8} more` : ''}` }
  }

  // ---- one category ----
  const cat = has(q, /how much|spent|spend|spending/) ? best(q, spendCats(s), (c) => `${c.name} ${(c.subs ?? []).join(' ')}`) : null
  if (cat) {
    const now = m.byCat[cat.id] || 0, plan = planFor(s, cat, THIS_MONTH), last = monthStats(s, addMonths(THIS_MONTH, -1)).byCat[cat.id] || 0
    return { topic: 'category', text: `You've spent ${cur(now)} on **${cat.name}** this month${plan > 0 ? `, against a plan of ${money0(plan)} (${now > plan ? `${money0(now - plan)} over` : `${money0(plan - now)} left`})` : ''}. Last month it was ${money0(last)}.` }
  }

  // ---- safe to spend / left this month ----
  if (has(q, /safe|left|how much (can|could) i|how much do i have|budget|spend today|money (left|free)|free to spend/)) {
    return { topic: 'safe', text: `You have ${cur(P.safe)} safe to spend this month${P.daysLeft > 0 && P.safe > 0 ? `, about **${money0(P.perDay)} a day** for the next ${P.daysLeft} day${P.daysLeft === 1 ? '' : 's'}` : ''}.\n\nHow it's worked out:\n- Money in: ${money0(P.moneyIn)}\n- Already spent: ${money0(m.spent)}\n- Put aside: ${money0(m.saved)}\n- Bills still to pay: ${money0(m.billsDue)}` }
  }

  // ---- this month's spending ----
  if (has(q, /spent|spending|this month|so far|month/)) {
    const last = monthStats(s, addMonths(THIS_MONTH, -1))
    return { topic: 'month', text: `So far this month you've spent ${cur(m.spent)}${P.plan ? ` of your ${money0(P.plan)} plan` : ''}, with ${money0(m.income)} in and ${money0(m.saved)} put aside.${P.isCur && P.plan ? ` At this pace the month ends around **${money0(P.forecast)}**${P.forecast > P.plan ? `, ${money0(P.forecast - P.plan)} over plan` : ', inside your plan'}.` : ''}\n\nLast month: ${money0(last.spent)} spent, ${money0(last.income)} in.` }
  }

  // ---- saving ----
  if (has(q, /sav(e|ing)|put aside/)) {
    const target = s.settings.ratios[2] / 100, rate = P.moneyIn ? (m.saved + m.savingDue) / P.moneyIn : 0
    return { topic: 'saving', text: `This month ${pct(rate)} of your money in is going to savings (${money0(m.saved)} so far). A healthy aim is ${pct(target)} or more, which would be about ${cur(P.moneyIn * target)} a month.${rate < target ? `\n\n- Setting up a regular saving on payday (Bills & pay) makes it automatic.` : '\n\nNice work.'}` }
  }

  // ---- net worth ----
  if (has(q, /worth|net worth|own|assets/)) {
    const w = worthNow(s)
    return { topic: 'worth', text: `You're worth about ${cur(w.net)}: you own ${money0(w.own)} and owe ${money0(w.owe)}.` }
  }
  return null
}

/** Examples of what the built-in answers handle, for when a question isn't understood. */
export const QUICK_EXAMPLES = ['How much is safe to spend?', 'Can I afford 1,200 tonight?', 'How is my money health?', 'Where can I cut back?', 'What bills are due?', 'When will my goal be done?']
