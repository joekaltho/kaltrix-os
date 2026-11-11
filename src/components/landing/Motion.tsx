'use client'

import { useEffect, useRef, useState } from 'react'

function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect() }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen] as const
}

// Counts up once when scrolled into view. The final value is always in the DOM
// (sr-only) so crawlers and screen readers never see the in-between numbers.
export function CountUp({ to, decimals = 0, suffix = '', className }: { to: number; decimals?: number; suffix?: string; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>()
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!seen) return
    const slow = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dur = slow ? 1400 : 1
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min((t - t0) / dur, 1)
      setV(to * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, to])
  return (
    <>
      <span className="sr-only">{to.toFixed(decimals)}{suffix}</span>
      <span ref={ref} aria-hidden className={className}>{v.toFixed(decimals)}{suffix}</span>
    </>
  )
}

// Cursor-following glow. Writes CSS variables straight to the element, so
// moving the mouse never triggers a React re-render.
export function Spotlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden group ${className}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
    >
      <div aria-hidden className="spot pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">{children}</div>
    </div>
  )
}

export function ScrollBar() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const h = document.documentElement
        const max = h.scrollHeight - h.clientHeight
        if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`
      })
    }
    window.addEventListener('scroll', on, { passive: true })
    on()
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [])
  return <div ref={ref} aria-hidden className="fixed top-0 left-0 right-0 z-[60] h-0.5 origin-left gradient-brand" style={{ transform: 'scaleX(0)' }} />
}

// Decorative only: bars carry no data, so there is nothing to misread.
export function Bars() {
  const [ref, seen] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} aria-hidden className="mt-5 flex items-end gap-1.5 h-16 max-w-xs">
      {[38, 52, 44, 66, 58, 80, 92].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-brand/70 origin-bottom transition-transform duration-700 ease-out"
          style={{ height: `${h}%`, transform: seen ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}

export function HeroVisual() {
  const chip = 'float absolute flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold shadow-lift'
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-lg pt-7">
      <div aria-hidden className="absolute inset-6 rounded-full bg-brand/20 blur-3xl" />
      {/* Second card peeking out from behind */}
      <div aria-hidden className="absolute top-0 left-8 -right-3 sm:-right-8 h-40 origin-bottom-left -rotate-3 rounded-3xl border border-border bg-ivoryDeep px-5 pt-2.5 shadow-card">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="w-2 h-2 rounded-full bg-brand" />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-inkFaint">Dashboard · Sample</span>
        </div>
      </div>
      <div className="relative rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-lift">
        <div className="flex items-center gap-3.5 mb-6">
          <span className="w-12 h-12 rounded-xl gradient-brand text-white text-lg font-black flex items-center justify-center">S</span>
          <div>
            <p className="font-black text-base leading-tight">Sunrise Tailors</p>
            <p className="text-inkFaint text-sm">Fashion · Lagos</p>
          </div>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-warn bg-warnBg border border-warnBorder px-2 py-0.5 rounded-full">Sample</span>
        </div>
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-border" />
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray="264" className="stroke-brand [animation:ring_1.6s_ease-out_0.4s_both]" />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <CountUp to={85} className="text-3xl font-black leading-none" />
              <span className="text-[10px] text-inkFaint font-bold uppercase tracking-wider mt-1">TrustScore</span>
            </span>
          </div>
          <ul className="space-y-2.5 text-sm sm:text-[15px] font-semibold">
            {['Verified business', 'Listed on Discover', '4.8 rating · 42 reviews'].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="text-brand font-black">✓</span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-inkFaint mb-2">Shop</p>
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-ivory border border-border p-2.5">
              <div className="h-1.5 w-9 rounded bg-border mb-1.5" />
              <div className="h-1.5 w-5 rounded bg-border" />
            </div>
          ))}
        </div>
      </div>
      <span className={`${chip} -left-2 sm:-left-10 top-20`}><i className="w-2 h-2 rounded-full bg-brand" />New booking · 2:00 PM</span>
      <span className={`${chip} -right-2 sm:-right-8 top-1/2`} style={{ animationDelay: '1.5s' }}><i className="w-2 h-2 rounded-full bg-warn" />Low stock · 3 left</span>
      <span className={`${chip} left-6 -bottom-4`} style={{ animationDelay: '0.8s' }}><i className="w-2 h-2 rounded-full bg-brand" />★ New review · 5.0</span>
    </div>
  )
}
