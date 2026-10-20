import type { ReactNode } from 'react'

// One grey block. Purely decorative: screen readers get the label from SkeletonRegion
// instead, and people who ask for reduced motion get a still block, not a pulse.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-ivoryDeep motion-reduce:animate-none ${className}`} />
}

// Wraps a skeleton layout so assistive tech announces a single "Loading ..." status
// instead of reading out dozens of empty blocks.
export function SkeletonRegion({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
