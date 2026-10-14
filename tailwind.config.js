/** Colours come from CSS variables in src/index.css so light and dark themes swap in one place. */
const v = (n) => `var(--${n})`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(
        ['bg','surface','surface2','ink','ink2','muted','line','line2','accent','accent-ink','accent-soft',
         'cover','cover-ink','cover-muted','cover-hi','good','good-soft','warn','warn-soft','bad','bad-soft',
         's1','s2','s3','s4','s5','s6','s7','s8','sother'].map((n) => [n, v(n)])
      ),
      fontFamily: { display: v('f-display').split(','), body: v('f-body').split(',') },
      borderRadius: { xl2: '20px' },
      boxShadow: { card: 'var(--shadow)', pop: 'var(--shadow-pop)' },
    },
  },
  plugins: [],
}
