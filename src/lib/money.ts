let cur = 'EUR'
let NF2: Intl.NumberFormat, NF0: Intl.NumberFormat, NFC: Intl.NumberFormat

export function setCurrency(c: string) {
  try {
    NF2 = new Intl.NumberFormat(undefined, { style: 'currency', currency: c, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    NF0 = new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 0 })
    NFC = new Intl.NumberFormat(undefined, { style: 'currency', currency: c, notation: 'compact', maximumFractionDigits: 1 })
    cur = c
  } catch {
    if (c !== 'EUR') setCurrency('EUR')
  }
}
setCurrency('EUR')

export const currency = () => cur
/** Whole amounts drop the cents; amounts with cents keep two decimals. */
export const money = (v: number) => (Math.abs(v) >= 1000 || Number.isInteger(+v) ? NF0 : NF2).format(v || 0)
/** Always two decimals, for exact figures like an EMI. */
export const money2 = (v: number) => NF2.format(v || 0)
export const money0 = (v: number) => NF0.format(Math.round(v || 0))
export const moneyShort = (v: number) => (Math.abs(v) < 1000 ? NF0.format(v) : NFC.format(v))
export const symbol = () => (NF0.formatToParts(0).find((p) => p.type === 'currency')?.value ?? cur)
export const pct = (v: number) => `${Math.round((isFinite(v) ? v : 0) * 100)}%`

export const CURRENCIES: [string, string][] = [
  ['EUR', 'Euro'], ['USD', 'US dollar'], ['GBP', 'British pound'], ['INR', 'Indian rupee'], ['CAD', 'Canadian dollar'],
  ['AUD', 'Australian dollar'], ['CHF', 'Swiss franc'], ['JPY', 'Japanese yen'], ['SEK', 'Swedish krona'], ['NOK', 'Norwegian krone'],
  ['DKK', 'Danish krone'], ['PLN', 'Polish złoty'], ['SGD', 'Singapore dollar'], ['AED', 'UAE dirham'], ['ZAR', 'South African rand'],
  ['BRL', 'Brazilian real'], ['MXN', 'Mexican peso'], ['NZD', 'New Zealand dollar'],
]
