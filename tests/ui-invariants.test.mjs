// Cheap, dependency-free guards for UI mistakes that typecheck/lint/build can't
// see (Tailwind silently ignores unknown class names; CSS containing-block rules
// aren't visible to the compiler). Behavioural UI checks were run in a throwaway
// jsdom harness; these keep the two sharpest findings from regressing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const css = read('src/app/globals.css')

test('NotificationBell renders its panel through a portal (the mobile top bar has backdrop-filter)', () => {
  // .glass sets backdrop-filter, which makes the bar the containing block for
  // position:fixed descendants. Without a portal the click-away layer covers only
  // the 48px bar on mobile and tapping elsewhere never closes the panel.
  assert.match(css, /\.glass\s*\{[^}]*backdrop-filter/, 'premise: .glass uses backdrop-filter')
  const bell = read('src/components/dashboard/NotificationBell.tsx')
  assert.match(bell, /import \{ createPortal \} from 'react-dom'/)
  assert.match(bell, /createPortal\(/)
  assert.match(bell, /document\.body/)
})

test('every custom colour/shadow token used by the new components exists in the theme', () => {
  const files = [
    'src/components/dashboard/NotificationBell.tsx',
    'src/components/dashboard/InventoryIntro.tsx',
    'src/components/dashboard/Sidebar.tsx',
  ]
  const customPlain = new Set(['ink', 'brand', 'surface', 'ivory', 'warn', 'danger', 'info', 'border'])
  const missing = []
  for (const f of files) {
    const src = read(f)
    // camelCase names (brandBg, inkFaint, ivoryDim...) are always custom tokens.
    for (const m of src.matchAll(/\b(?:bg|text|border|ring|divide|from|to|via|fill|stroke)-([a-z]+[A-Z][A-Za-z]*)\b/g)) {
      if (!css.includes(`--color-${m[1]}:`)) missing.push(`${f}: ${m[0]}`)
    }
    for (const m of src.matchAll(/\b(?:bg|text|border|ring|divide)-(ink|brand|surface|ivory|warn|danger|info|border)(?![A-Za-z-])/g)) {
      if (!customPlain.has(m[1]) || !css.includes(`--color-${m[1]}:`)) missing.push(`${f}: ${m[0]}`)
    }
    for (const m of src.matchAll(/\bshadow-(card|lift|brand|brandLg|modal)\b/g)) {
      if (!css.includes(`--shadow-${m[1]}:`)) missing.push(`${f}: ${m[0]}`)
    }
  }
  assert.deepEqual(missing, [], `unknown theme tokens (Tailwind would silently drop them): ${missing.join(', ')}`)
})
