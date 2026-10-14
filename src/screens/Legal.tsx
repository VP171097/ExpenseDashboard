import { ArrowLeft, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import Footer from '../components/Footer'
import { useLegal, type LegalDoc } from '../lib/entry'

const UPDATED = '14 October 2026'
const CONTACT = 'https://github.com/VP171097/ExpenseDashboard/issues'

/** The privacy policy and the terms and conditions. Written to match what the app actually does. */
export default function Legal({ doc }: { doc: LegalDoc }) {
  const { close, open } = useLegal()
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2.5 font-display text-[22px] font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cover text-cover-ink"><Wallet size={18} /></span>Tally</p>
          <button type="button" onClick={close} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[14px] font-semibold hover:border-accent"><ArrowLeft size={16} />Back</button>
        </header>
        <div className="mb-6 flex gap-2" role="tablist" aria-label="Legal pages">
          {(['privacy', 'terms'] as const).map((d) => (
            <button key={d} type="button" role="tab" aria-selected={doc === d} onClick={() => doc !== d && open(d)} className={`rounded-full px-4 py-1.5 text-[14px] font-semibold ${doc === d ? 'bg-accent text-accent-ink' : 'bg-surface2 text-ink2 hover:text-ink'}`}>{d === 'privacy' ? 'Privacy policy' : 'Terms & conditions'}</button>
          ))}
        </div>
        <article className="legal card p-6 sm:p-9">{doc === 'privacy' ? <Privacy /> : <Terms />}</article>
        <Footer className="mt-10" />
      </div>
    </div>
  )
}

const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-8 text-[20px] font-extrabold first:mt-0">{children}</h2>
const P = ({ children }: { children: ReactNode }) => <p className="mb-3 text-[15px] leading-relaxed text-ink2">{children}</p>
const L = ({ items }: { items: ReactNode[] }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink2">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
const Contact = () => <a className="font-semibold text-accent" href={CONTACT} target="_blank" rel="noreferrer">the project's contact page</a>

function Privacy() {
  return (
    <>
      <h1 className="text-[30px] font-extrabold leading-tight">Privacy policy</h1>
      <p className="mb-6 text-[13px] text-muted">Last updated {UPDATED}</p>
      <P>Tally is a budgeting app for you and your family. This policy explains what information Tally handles, where it goes and the choices you have. In short: your money data stays in your browser unless you choose to log in or ask Tally AI a question. There are no ads, no tracking and no selling of data.</P>

      <H>1. Using Tally without an account</H>
      <P>Everything you enter (entries, bills, plans, goals, loans and EMIs, accounts and settings) is saved only in your browser's own storage on your device. It is not sent to us or anyone else. It is private to that browser but <b>not encrypted</b>, so anyone who can use your device and browser profile could see it. Clearing your browsing data, using a private window or losing the device can delete it, so download a backup from Settings now and then.</P>

      <H>2. If you create an account</H>
      <P>Logging in is optional. If you do, we use Supabase, a cloud database provider, to:</P>
      <L items={[
        <>store your login: your email address, an encrypted form of your password (or your Google account ID and name if you use Google sign-in) and when you signed up and last logged in;</>,
        <>store a copy of your Tally data so you can use it on more than one device. Only your login can read your copy. It is protected in transit and by Supabase's storage security, but it is <b>not end-to-end encrypted</b>, so the people who run the service could technically access it. We do not look at it except where needed to fix a problem you report or where the law requires it.</>,
      ]} />
      <P>Example data is never uploaded.</P>

      <H>3. Tally AI</H>
      <P>Common questions are answered instantly on your device. When you ask Tally AI something it can't answer that way, and only then, a summary of your dashboard is sent through our server to Google's Gemini AI service to write the answer. The summary contains your monthly totals, plan and spending by category, bills, accounts, goals, debts, loans, trips and your most recent entries. Entry descriptions are included unless you turn that off in Settings.</P>
      <P>Your question and the summary are not stored by Tally. Google processes them under its own terms, which may allow it to keep and review them for a limited time, including to improve its services. Don't include passwords, card numbers or other secrets in a question. You can switch Tally AI off at any time in Settings; then nothing is sent.</P>

      <H>4. Other services the app connects to</H>
      <L items={[
        <><b>GitHub Pages</b> hosts the app. Like any website host, it receives your IP address and browser details when the page loads.</>,
        <><b>Google Fonts</b> supplies the typefaces, so Google receives your IP address when fonts load.</>,
        <><b>Google sign-in</b>, if you choose it, shares your name and email address with us under Google's terms.</>,
      ]} />
      <P>We use no analytics, advertising or tracking tools and set no tracking cookies. Your browser stores your login session and preferences locally so the app works.</P>

      <H>5. How long we keep information</H>
      <P>Data in your browser stays until you delete it. Your cloud copy stays until you delete it (Settings → Account & sync → Delete cloud copy) or your account is removed. Your login stays until you ask us to delete it.</P>

      <H>6. Your choices and rights</H>
      <L items={[
        'See all your data any time in the app, and download it as a backup or an Excel workbook from Settings.',
        'Correct anything by editing it.',
        'Delete your cloud copy from Settings, and erase this device with "Erase all" or "Log out and clear this device".',
        <>Ask us to delete your login, or ask any question about your data, through <Contact />.</>,
      ]} />
      <P>Depending on where you live, you may have further rights, such as to object to processing or complain to a data protection authority.</P>

      <H>7. Security</H>
      <P>Connections to our services use HTTPS. Cloud data is protected by row-level security so each login can only reach its own copy. No system is perfectly secure; please use a strong, unique password and keep your device locked.</P>

      <H>8. Children</H>
      <P>Tally is not meant for children under 13, and we don't knowingly collect their information.</P>

      <H>9. Changes</H>
      <P>If this policy changes, we'll update the date at the top and, for important changes, show a notice in the app.</P>

      <H>10. Contact</H>
      <P>Questions or requests: use <Contact />.</P>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1 className="text-[30px] font-extrabold leading-tight">Terms & conditions</h1>
      <p className="mb-6 text-[13px] text-muted">Last updated {UPDATED}</p>
      <P>These terms apply when you use Tally. By using it you agree to them. If you don't agree, please don't use the app.</P>

      <H>1. What Tally is</H>
      <P>Tally is a free tool for keeping track of your own and your family's money: entries, bills, plans, goals, loans and EMIs. It is <b>not a bank</b>, does not hold or move money, and does not connect to your bank accounts.</P>

      <H>2. Not financial advice</H>
      <P>Everything Tally shows, including safe-to-spend figures, health scores, payoff dates, EMI amounts and schedules, and Tally AI answers, is general information worked out from what you enter. It is not financial, tax, legal or investment advice. Check important decisions with your lender's own statements and, where needed, a qualified professional.</P>

      <H>3. Calculations are estimates</H>
      <P>EMI amounts, interest and balances are worked out on a standard reducing-balance method. Your lender may round, count days or charge fees differently, so figures can differ from your statement. Your lender's figures are the ones that count.</P>

      <H>4. Tally AI</H>
      <P>Tally AI answers are written by an AI model and can be wrong or incomplete. Don't rely on them alone. Use of Tally AI may be limited or switched off at any time.</P>

      <H>5. Your account and your data</H>
      <L items={[
        'You are responsible for what you enter and for keeping your password and device secure.',
        'Keep your own backups. Data in a browser can be lost, and we cannot recover data that was never synced.',
        'Your data remains yours. We only use it to run the app for you, as described in the privacy policy.',
      ]} />

      <H>6. Fair use</H>
      <P>Don't misuse the service: no attempts to access other people's data, overload or break the service, or use it for anything unlawful. We may suspend accounts that do.</P>

      <H>7. Availability and changes</H>
      <P>Tally is provided free, "as is" and "as available". We may change, pause or stop features (including accounts, sync and Tally AI) at any time. Where we can, we'll give notice so you can download your data.</P>

      <H>8. Liability</H>
      <P>To the extent the law allows, we are not liable for any loss arising from use of the app, including money decisions made using its figures, missed payments, or lost data. Nothing in these terms limits rights you have under consumer law that cannot be excluded.</P>

      <H>9. Changes to these terms</H>
      <P>We may update these terms. The date at the top shows the latest version. Continuing to use Tally after a change means you accept it.</P>

      <H>10. Contact</H>
      <P>Questions about these terms: use <Contact />.</P>
    </>
  )
}
