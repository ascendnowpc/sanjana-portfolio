import { useRef, useState } from 'react'
import type { AdminSettings } from '@/types/content'
import type { PublishStatus } from '@/lib/publish'
import { Group, Text } from '@/components/admin/fields'

/**
 * The password, publishing, and the honest description of what each is worth.
 *
 * Every word of the warning below is load-bearing, and the arrival of publishing
 * changed exactly one thing about it: the password is now checked in *two*
 * places, and only one of them is trustworthy. The copy in the browser decides
 * who is shown the editing UI, and it ships with the bundle, so it can be read
 * by anybody who looks. The copy in `ADMIN_PASSWORD` on the deployment decides
 * who can change the site for everybody, and it never leaves the server.
 *
 * Which is why the two must not be the same string. Saying so here is the point
 * of this tab: this is the one piece of copy on the site that could hurt
 * somebody if it were vague.
 */
export function AccessSection({
  value,
  onChange,
  onExport,
  onImport,
  onReset,
  hasLocalEdits,
  publishedAt,
  publishStatus,
}: {
  value: AdminSettings
  onChange: (next: AdminSettings) => void
  onExport: () => void
  onImport: (json: string) => void
  onReset: () => void
  hasLocalEdits: boolean
  /** When the running deploy's content was published. Null before the first. */
  publishedAt: string | null
  /** What the deployment can and cannot do. Null while it is being asked. */
  publishStatus: PublishStatus | null
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
            It keeps a passing visitor out of the editor. It does not keep out
            anybody who looks: it is checked in the browser and therefore also
            shipped to it, so it can be read out of the published JavaScript, and
            the editing UI can be opened without it by anyone who knows how.
          </p>
          <p className="mt-3 text-[0.8rem] leading-relaxed text-neutral-300">
            What it cannot do is change the site for anybody else. Publishing and
            uploading go through two functions that check{' '}
            <code className="font-mono text-[0.75rem] text-neutral-300">
              ADMIN_PASSWORD
            </code>{' '}
            again on the server, and the token that can write to the repository
            is never in the page.{' '}
            <strong className="font-normal text-amber-200/90">
              Set that one to a different, longer password than this one
            </strong>
            {' '}— this field is public, and that one is the real lock. See
            EDITING.md.
          </p>
          <p className="mt-3 text-[0.8rem] leading-relaxed text-neutral-300">
            Nothing on these tabs is private in any case: every field here is
            content the site displays.
          </p>
        </div>
      </Group>

      <Group
        title="Publishing"
        description="What turns an edit in this browser into an edit in the code. The content is committed to src/content/published.json on the deployment’s own branch, and the build that follows carries it to everybody."
      >
        {!publishStatus ? (
          <p className="text-[0.8rem] text-neutral-500">Checking…</p>
        ) : publishStatus.configured ? (
          <div className="space-y-2 text-[0.8rem] leading-relaxed text-neutral-400">
            <p>
              Ready. Publishing commits to{' '}
              <code className="font-mono text-[0.75rem] text-neutral-300">
                {publishStatus.repo}
              </code>{' '}
              on{' '}
              <code className="font-mono text-[0.75rem] text-neutral-300">
                {publishStatus.branch}
              </code>
              .
            </p>
            <p>
              {publishedAt
                ? `This deployment’s content was published ${new Date(publishedAt).toLocaleString()}.`
                : 'Nothing has been published from the site yet — this deployment is showing the content in the data files.'}
            </p>
          </div>
        ) : (
          <div className="rounded-sm border border-amber-500/25 bg-amber-500/[0.06] p-4 text-[0.8rem] leading-relaxed text-neutral-300">
            <p>
              {publishStatus.unavailable ??
                `Not set up: ${publishStatus.missing.join(', ')} ${
                  publishStatus.missing.length === 1 ? 'is' : 'are'
                } not set on this deployment.`}
            </p>
            <p className="mt-2">
              Until it is, edits stay in this browser and Export JSON below is
              the way to hand them over. EDITING.md has the five minutes of
              setup.
            </p>
          </div>
        )}
      </Group>

      <Group
        title="Where your unpublished edits live"
        description="Until they are published, saved changes are kept in this browser, on this device. They survive a reload and a closed tab; they do not travel to another computer, another browser, or to anybody else visiting the site."
      >
        <p className="text-[0.8rem] leading-relaxed text-neutral-400">
          {hasLocalEdits
            ? 'This browser is currently showing unpublished edits. Everyone else sees what was last published.'
            : 'This browser has no unpublished edits — you are seeing exactly what the deploy is serving.'}
        </p>
        <p className="text-[0.8rem] leading-relaxed text-neutral-400">
          Publish is the way to make an edit permanent for everybody. Export JSON
          is the other way: hand the file to whoever deploys the site and the
          values in it replace the defaults in{' '}
          <code className="font-mono text-[0.75rem] text-neutral-300">
            src/data/
          </code>
          , or load the archive rows into Supabase. Clearing this browser’s site
          data clears anything unpublished, so export anything you would be sorry
          to lose.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onExport}
            className="cursor-pointer rounded-sm border border-white/25 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white hover:bg-white/10"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-sm border border-white/15 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-white/45 hover:text-white"
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
        description="Throws away every unpublished edit in this browser and puts the site back to what the deploy is serving. It cannot be undone — export or publish first if there is anything worth keeping."
      >
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-300">
              Discard all unpublished edits?
            </span>
            <button
              type="button"
              onClick={() => {
                onReset()
                setConfirming(false)
              }}
              className="cursor-pointer rounded-sm border border-red-500/60 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500 hover:text-white"
            >
              Yes, discard
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="cursor-pointer rounded-sm border border-white/15 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-white/45 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!hasLocalEdits}
            onClick={() => setConfirming(true)}
            className="cursor-pointer rounded-sm border border-white/15 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-red-500/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/15 disabled:hover:text-neutral-300"
          >
            Reset everything
          </button>
        )}
      </Group>
    </div>
  )
}
