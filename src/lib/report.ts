/**
 * The monthly report as a PDF, made entirely in the browser: nothing is uploaded.
 * Loaded only when someone asks for a report.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import regularUrl from '../assets/fonts/DejaVuSans-subset.ttf?url'
import boldUrl from '../assets/fonts/DejaVuSans-Bold-subset.ttf?url'
import { APP } from './brand'
import { budgetItems, catName, health, monthPicture, planFor, spendCats, sum } from './calc'
import { fmtDate, monthName, TODAY } from './dates'
import { emiStatus } from './emi'
import { money, money2 } from './money'
import type { State } from './types'

const b64 = async (url: string) => {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

const INK: [number, number, number] = [25, 25, 43], MUTED: [number, number, number] = [110, 112, 135], ACCENT: [number, number, number] = [91, 75, 219]

export async function monthlyReport(s: State, k: string): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  // a font with every currency sign, so amounts print correctly
  doc.addFileToVFS('DejaVuSans.ttf', await b64(regularUrl)); doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal')
  doc.addFileToVFS('DejaVuSans-Bold.ttf', await b64(boldUrl)); doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold')
  doc.setFont('DejaVu', 'normal')
  const W = doc.internal.pageSize.getWidth(), M = 40
  const P = monthPicture(s, k), m = P.m, H = health(s, k)
  let y = M

  // ---- heading ----
  doc.setFillColor(...ACCENT); doc.roundedRect(M, y, 26, 26, 6, 6, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('DejaVu', 'bold'); doc.setFontSize(13); doc.text('S', M + 13, y + 18, { align: 'center' })
  doc.setTextColor(...INK); doc.setFontSize(18); doc.text(`${APP} · Monthly report`, M + 36, y + 13)
  doc.setFont('DejaVu', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...MUTED)
  doc.text(`${monthName(k)}${s.settings.name ? ` · ${s.settings.name}` : ''}${s.sample ? ' · example data' : ''} · made ${fmtDate(TODAY, { day: 'numeric', month: 'long', year: 'numeric' })}`, M + 36, y + 27)
  y += 48

  // ---- the month at a glance ----
  const boxes: [string, number, string][] = [
    ['Money in', P.moneyIn, P.opening ? `includes ${money(P.opening)} you started with` : m.expectedIn ? `${money(m.expectedIn)} still expected` : 'all arrived'],
    ['Spent', m.spent, `${money(m.everydaySpent)} everyday, the rest bills`],
    ['Put aside', m.saved + m.savingDue, m.savingDue ? `${money(m.savingDue)} still planned` : 'savings and investing'],
    [P.isCur || P.isFuture ? 'Safe to spend' : 'Left over', P.safe, `${money(m.billsDue - m.savingDue)} in bills still to pay`],
  ]
  const bw = (W - M * 2 - 3 * 10) / 4
  boxes.forEach(([l, v, sub], i) => {
    const x = M + i * (bw + 10)
    doc.setFillColor(243, 241, 250); doc.roundedRect(x, y, bw, 62, 8, 8, 'F')
    doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(l.toUpperCase(), x + 10, y + 16)
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(14); doc.setTextColor(...(v < 0 ? [190, 40, 40] as [number, number, number] : INK)); doc.text(money(v), x + 10, y + 36)
    doc.setFont('DejaVu', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(doc.splitTextToSize(sub, bw - 20)[0], x + 10, y + 52)
  })
  y += 76
  doc.setFontSize(10); doc.setTextColor(...INK)
  doc.text(`Money health score: ${H.score} out of 100 (${H.label}).`, M, y); y += 8

  const table = (title: string, head: string[], body: (string | number)[][], right: number[] = [], empty = 'Nothing this month.') => {
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = M }
    y += 18
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...INK); doc.text(title, M, y)
    doc.setFont('DejaVu', 'normal')
    if (!body.length) { doc.setFontSize(9.5); doc.setTextColor(...MUTED); doc.text(empty, M, y + 16); y += 22; return }
    autoTable(doc, {
      startY: y + 8, head: [head], body: body.map((r) => r.map(String)), margin: { left: M, right: M },
      styles: { font: 'DejaVu', fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: [228, 226, 238], lineWidth: 0.5 },
      headStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: [243, 241, 250], textColor: MUTED },
      columnStyles: Object.fromEntries(right.map((c) => [c, { halign: 'right' as const }])),
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  }

  // ---- plan vs spending ----
  const cats = spendCats(s).map((c) => ({ c, plan: planFor(s, c, k), spent: m.byCat[c.id] || 0 })).filter((x) => x.plan || x.spent).sort((a, b) => b.spent - a.spent)
  table('Plan vs spending', ['Category', 'Plan', 'Spent', 'Left'], [
    ...cats.map((x) => [x.c.name, money(x.plan), money(x.spent), money(x.plan - x.spent)]),
    ...(cats.length ? [['Total', money(sum(cats.map((x) => x.plan))), money(sum(cats.map((x) => x.spent))), money(sum(cats.map((x) => x.plan - x.spent)))]] : []),
  ], [1, 2, 3])

  // ---- bills and regular payments ----
  const items = budgetItems(s, k)
  const regular = items.filter((t) => t.virtual).sort((a, b) => a.date.localeCompare(b.date))
  table('Bills, pay and regular payments', ['Date', 'What', 'Amount', 'Status'], regular.map((t) => [
    fmtDate(t.date, { day: 'numeric', month: 'short' }), t.note, `${t.type === 'income' ? '+' : '−'}${money(t.amount)}`,
    (t.type === 'income' ? (t.paid ? 'Arrived' : 'Expected') : t.paid ? 'Paid' : 'Due') + ((t as { carried?: boolean }).carried ? ' (for this month)' : ''),
  ]), [2])

  // ---- loans and EMIs ----
  const emis = (s.emis ?? []).map((e) => ({ e, st: emiStatus(e) })).filter((x) => x.st.left > 0 || x.st.thisMonth)
  if (emis.length) table('Loans & EMIs', ['Loan', 'EMI', 'This month', 'Still owed', 'Last EMI'], emis.map(({ e, st }) => [
    e.name, money2(st.emi), st.thisMonth ? `EMI ${st.thisMonth.n} of ${e.months} · ${fmtDate(st.thisMonth.date)}` : '—', money(st.owed), fmtDate(st.last, { month: 'short', year: 'numeric' }),
  ]), [1, 3])

  // ---- goals ----
  if (s.goals.length) table('Savings goals', ['Goal', 'Saved', 'Target', 'By'], s.goals.map((g) => [g.name, money(g.saved), money(g.target), fmtDate(g.due, { month: 'short', year: 'numeric' })]), [1, 2])

  // ---- every entry ----
  const entries = items.filter((t) => !t.virtual).sort((a, b) => a.date.localeCompare(b.date))
  table(`Every entry (${entries.length})`, ['Date', 'Description', 'Category', 'Who', 'Amount'], entries.map((t) => [
    fmtDate(t.date, { day: 'numeric', month: 'short' }), t.note || '—', catName(s, t.cat) + (t.sub ? ` · ${t.sub}` : ''), t.person ?? '', `${t.type === 'income' ? '+' : '−'}${money(t.amount)}`,
  ]), [4], 'No one-off entries this month.')

  // ---- page footers ----
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUTED)
    const h = doc.internal.pageSize.getHeight()
    doc.text(`${APP} · ${monthName(k)} · worked out from what you entered; not financial advice.`, M, h - 22)
    doc.text(`Page ${i} of ${n}`, W - M, h - 22, { align: 'right' })
  }
  return doc.output('blob')
}
