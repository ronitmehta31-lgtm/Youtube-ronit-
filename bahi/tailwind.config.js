// Colours are roles from replica/design/tokens.json, exposed as CSS variables in src/index.css.
const roles = ['bg','surface','surface-2','border','border-input','text','text-muted','accent','accent-strong','accent-soft',
  'on-accent','danger','danger-soft','success','success-soft','warning','warning-soft','nav','on-nav','on-nav-muted'];
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(roles.map((r) => [r, `var(--c-${r})`])),
      borderRadius: { sm: '6px', md: '8px', lg: '12px' },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
      fontFamily: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
      width: { sidebar: '232px' },
    },
  },
  plugins: [],
};
