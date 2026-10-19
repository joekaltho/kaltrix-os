'use client'

import { useEffect, useMemo, useState } from 'react'
import { ImageIcon, Trash2, Undo2, Upload } from 'lucide-react'
import { LISTING_IMAGE_ACCEPT, LISTING_IMAGE_MAX_LABEL, LISTING_IMAGE_TYPES_LABEL } from '@/lib/listing-image'
import { precheckImageFile } from '@/lib/listing-image-client'

// What the owner has asked for, held by the parent form until they press Save:
//   file   - a newly chosen image (uploaded only when the form is saved)
//   remove - take the current image off the listing
// Nothing here talks to the server, so leaving the form never strands an upload.
export interface ListingImageValue {
  file: File | null
  remove: boolean
}

interface Props {
  // The image the listing has saved right now (an uploaded file or an older pasted URL).
  currentUrl: string | null
  value: ListingImageValue
  onChange: (next: ListingImageValue) => void
  disabled?: boolean
}

const labelClass = 'text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block'

export default function ListingImageField({ currentUrl, value, onChange, disabled = false }: Props) {
  const [pickError, setPickError] = useState('')
  const [checking, setChecking] = useState(false)

  const previewUrl = useMemo(() => (value.file ? URL.createObjectURL(value.file) : ''), [value.file])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const shown = value.remove ? '' : previewUrl || currentUrl || ''
  const busy = disabled || checking

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be chosen again after an error
    if (!file) return
    setChecking(true)
    const problem = await precheckImageFile(file)
    setChecking(false)
    if (problem) {
      setPickError(problem)
      return
    }
    setPickError('')
    onChange({ file, remove: false })
  }

  return (
    <div>
      <span className={labelClass}>Image</span>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-ivoryDim text-inkFaint sm:h-28 sm:w-28">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Listing image preview" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-7 w-7" aria-hidden />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink transition focus-within:outline focus-within:outline-2 focus-within:outline-brandDim ${
                busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-ivoryDim'
              }`}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {checking ? 'Checking…' : shown ? 'Replace image' : 'Upload image'}
              <input
                type="file"
                accept={LISTING_IMAGE_ACCEPT}
                className="sr-only"
                onChange={handlePick}
                disabled={busy}
              />
            </label>

            {shown && (
              <button
                type="button"
                onClick={() => onChange({ file: null, remove: Boolean(currentUrl) })}
                disabled={busy}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-dangerBorder bg-dangerBg px-3 text-xs font-semibold text-danger transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Remove
              </button>
            )}

            {value.remove && (
              <button
                type="button"
                onClick={() => onChange({ file: null, remove: false })}
                disabled={busy}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink transition hover:bg-ivoryDim disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" aria-hidden />
                Undo
              </button>
            )}
          </div>

          <p className="mt-1.5 text-xs text-inkFaint">
            {value.remove
              ? 'The image will be removed when you save.'
              : value.file
                ? 'New image selected. It uploads when you save.'
                : `${LISTING_IMAGE_TYPES_LABEL}, up to ${LISTING_IMAGE_MAX_LABEL}. Shown in your public Shop.`}
          </p>
          {pickError && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{pickError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
