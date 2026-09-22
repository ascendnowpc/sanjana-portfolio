import { useRef, useState } from 'react'
import type { AdminSettings } from '@/types/content'
import { Group, Text } from '@/components/admin/fields'

/**
 * The password, and the honest description of what it is worth.
 *
 * Every word of that warning is load-bearing. This site has no server of its
 * own: it is static files and a browser, so a password it checks is a password
 * it also *ships*. Anyone who opens the built JavaScript can read it, and
 * anyone who opens devtools can set the flag it guards without knowing it at
 * all. It is a door that keeps a passer-by out of a room they had no reason to
 * enter. It is not a lock, and saying otherwise here would be the one piece of
 * copy on this site that could actually hurt somebody.
 */
export function AccessSection({
  value,
  onChange,
  onExport,
  onImport,
  onReset,
  hasLocalEdits,
}: {
  value: AdminSettings
  onChange: (next: AdminSettings) => void
  onExport: () => void
  onImport: (json: string) => void
  onReset: () => void
  hasLocalEdits: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-6">
      <Group
        title="Password"
        description="What this panel asks for at the door."
      >
        <Text
          label="Password"
          mono
          value={value.password}
          onChange={(v) => onChange({ ...value, password: v })}
        />
        <div className="rounded-sm border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-[0.62rem] tracking-[0.18em] text-amber-300/90 uppercase">
            What this password protects
          </p>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-neutral-300">
            It keeps a passing visitor out of the panel. It does not keep out
            anybody who looks: the site is static files with no server behind
            them, so the password is checked in the browser and therefore also
            shipped to it. It can be read out of the published JavaScript, and
            the panel can be opened without it by anyone who knows how.
          </p>
          <p className="mt-3 text-[0.8rem] leading-relaxed text-neutral-300">
            Nothing here is exposed that is not already public — every field on
            these tabs is content the site displays. But do not put anything
            private behind this door, and do not reuse a password from
            anywhere else. Real protection needs a server that holds both the
            password and the content; see DATABASE.md.
          </p>
        </div>
      </Group>

      <Group
        title="Where your edits live"
        description="Saved changes are kept in this browser, on this device. They survive a reload and a closed tab; they do not travel to another computer, another browser, or to anybody else visiting the site."
      >
        <p className="text-[0.8rem] leading-relaxed text-neutral-400">
          {hasLocalEdits
            ? 'This browser is currently showing saved edits. Everyone else sees what was last deployed.'
            : 'This browser has no saved edits — you are seeing exactly what was deployed.'}
        </p>
        <p className="text-[0.8rem] leading-relaxed text-neutral-400">
          To make an edit permanent for everybody, export it and hand the file
          to whoever deploys the site: the values in it replace the defaults in{' '}
          <code className="font-mono text-[0.75rem] text-neutral-300">
            src/data/
          </code>
          , or load the archive rows into Supabase. Clearing this browser’s site
          data also clears these edits, so export anything you would be sorry to
          lose.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onExport}
            className="rounded-sm border border-white/25 px-4 py-2 text-[0.62rem] tracking-[0.18em] text-white uppercase transition-colors hover:border-white hover:bg-white hover:text-black"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-sm border border-white/15 px-4 py-2 text-[0.62rem] tracking-[0.18em] text-neutral-300 uppercase transition-colors hover:border-white/45 hover:text-white"
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              // Cleared first: picking the same file twice in a row fires no
              // change event otherwise, and a failed import is exactly when
              // somebody retries with the same file.
              e.target.value = ''
              if (!file) return
              onImport(await file.text())
            }}
          />
        </div>
      </Group>

      <Group
        title="Start again"
        description="Throws away every saved edit in this browser and puts the site back to what it shipped with. It cannot be undone — export first if there is anything worth keeping."
      >
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-300">
              Discard all local edits?
            </span>
            <button
              type="button"
              onClick={() => {
                onReset()
                setConfirming(false)
              }}
              className="rounded-sm border border-red-500/60 px-4 py-2 text-[0.62rem] tracking-[0.18em] text-red-300 uppercase transition-colors hover:bg-red-500 hover:text-white"
            >
              Yes, discard
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-sm border border-white/15 px-4 py-2 text-[0.62rem] tracking-[0.18em] text-neutral-300 uppercase transition-colors hover:border-white/45"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!hasLocalEdits}
            onClick={() => setConfirming(true)}
            className="rounded-sm border border-white/15 px-4 py-2 text-[0.62rem] tracking-[0.18em] text-neutral-300 uppercase transition-colors hover:border-red-500/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/15 disabled:hover:text-neutral-300"
          >
            Reset everything
          </button>
        )}
      </Group>
    </div>
  )
}
