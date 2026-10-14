import { FileDown, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { monthName } from '../lib/dates'
import { saveFile } from '../lib/files'
import { toast, useStore } from '../lib/store'

/** Downloads the PDF report for the month on screen. */
export default function ReportButton({ month, label = false }: { month: string; label?: boolean }) {
  const [busy, setBusy] = useState(false)
  const make = async () => {
    setBusy(true)
    try {
      const { monthlyReport } = await import('../lib/report')
      const s = useStore.getState().data!
      const r = await saveFile(`spendcop-${month}.pdf`, await monthlyReport(s, month))
      toast(r === 'saved' ? `Your ${monthName(month)} report is ready` : r === 'declined' ? 'Download cancelled' : 'Could not save the report here')
    } catch { toast("Couldn't make the report. Try again.") } finally { setBusy(false) }
  }
  return (
    <button type="button" onClick={make} disabled={busy} aria-label={`Download the ${monthName(month)} report as a PDF`} title="Monthly PDF report"
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 font-semibold text-ink shadow-card hover:border-accent disabled:opacity-60">
      {busy ? <RefreshCw size={17} className="animate-spin text-accent" /> : <FileDown size={18} className="text-accent" />}<span className={label ? '' : 'hidden xl:inline'}>{busy ? 'Making PDF…' : 'PDF report'}</span>
    </button>
  )
}

