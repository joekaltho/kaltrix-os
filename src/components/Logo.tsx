import { MARK_PATH, WORDMARK_PATH } from './logo-paths'

// KaltrixOS logo. One monochrome artwork (stepped block + diamond cut-out,
// condensed wordmark) drawn with currentColor, so it works on any background:
//   tone="auto"    follows the theme (dark green on light, off-white on dark)
//   tone="onDark"  always light  -> surfaces that are dark in both themes
//   tone="onLight" always dark   -> surfaces that are light in both themes
//
// The horizontal lockup (mark left, wordmark right) is derived from the master
// stacked artwork in public/brand/ for navigation bars.

const toneClass = { auto: 'text-logo', onDark: 'text-logoPaper', onLight: 'text-logoInk' } as const

// Lockup geometry in the artwork's units: mark is 387 x 399; wordmark is
// scaled to ~46% of mark height and vertically centred beside it.
const WORD_SCALE = 1.95
const LOCKUP_W = 1227
const LOCKUP_H = 399

// Height in px of the mark (the lockup is as tall as the mark).
const sizes = { sm: 24, md: 30, lg: 44 } as const

type Common = { tone?: keyof typeof toneClass; className?: string }

export function LogoMark({ size = 28, tone = 'auto', className = '' }: Common & { size?: number }) {
  return (
    <svg
      role="img"
      aria-label="KaltrixOS"
      viewBox="0 0 387 399"
      width={(size * 387) / 399}
      height={size}
      className={`${toneClass[tone]} ${className}`}
    >
      <path transform="translate(-318 -312)" fill="currentColor" fillRule="evenodd" d={MARK_PATH} />
    </svg>
  )
}

export default function Logo({ size = 'md', tone = 'auto', className = '' }: Common & { size?: keyof typeof sizes }) {
  const h = sizes[size]
  return (
    <svg
      role="img"
      aria-label="KaltrixOS"
      viewBox={`0 0 ${LOCKUP_W} ${LOCKUP_H}`}
      width={(h * LOCKUP_W) / LOCKUP_H}
      height={h}
      className={`shrink-0 ${toneClass[tone]} ${className}`}
    >
      <g fill="currentColor" fillRule="evenodd">
        <path transform="translate(-318 -312)" d={MARK_PATH} />
        <path
          transform={`translate(451 ${199.5 - (96 * WORD_SCALE) / 2}) scale(${WORD_SCALE}) translate(-328 -748)`}
          d={WORDMARK_PATH}
        />
      </g>
    </svg>
  )
}
