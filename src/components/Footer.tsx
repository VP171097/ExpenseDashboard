import { Wallet } from 'lucide-react'
import { useLegal } from '../lib/entry'

/** The footer shown under every screen: the app, the landing page, sign-in, setup and the legal pages. */
export default function Footer({ className = '' }: { className?: string }) {
  const open = useLegal((l) => l.open)
  const link = 'text-[13.5px] font-semibold text-ink2 hover:text-ink'
  return (
    <footer className={`border-t border-line pt-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="flex items-center gap-2 font-display text-[16px] font-extrabold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-ink"><Wallet size={14} /></span>Tally</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <button type="button" className={link} onClick={() => open('privacy')}>Privacy policy</button>
          <button type="button" className={link} onClick={() => open('terms')}>Terms & conditions</button>
          <a className={link} href="https://github.com/VP171097/ExpenseDashboard/issues" target="_blank" rel="noreferrer">Contact & feedback</a>
        </nav>
      </div>
      <p className="mt-3 text-[12px] text-muted">© {new Date().getFullYear()} Tally. A personal and family budgeting tool. Not a bank and not financial advice.</p>
    </footer>
  )
}
