import { useCallback, useEffect, useRef, useState } from 'react'
import { useSiteContent } from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import type { ContentPath } from '@/lib/contentStore'
import { mediaUrl } from '@/lib/media'
import {
  uploadMedia,
  uploadStatus,
  type MediaKind,
  type UploadStatus,
} from '@/lib/uploads'
import {
  deriveFromVideo,
  runtimeFrom,
  ffmpegReady,
  FFMPEG_DOWNLOAD_MB,
  type Derived,
  type Stage,
} from '@/lib/videoPipeline'
import { fieldLabel } from '@/components/edit/Editable'

/** What one dropped file turned into, as media keys. */
export interface MediaResult {
  /** The file itself. */
  key: string
  audio?: string
  poster?: string
  preview?: string
  aspect?: number
  /** Seconds. */
  duration?: number
  /** `m:ss`. */
  runtime?: string
}

export type DeriveKind = 'audio' | 'poster' | 'preview'

/**
 * Where the files that come out of one video should be written.
 *
 * A performance has four fields for one recording — the film, its soundtrack,
 * its poster, its hover loop — plus the two facts the layout needs, the aspect
 * ratio and the runtime. Naming them here is what lets the dialog fill all six
 * from one dropped file: it does not have to know it is editing a performance,
 * and a caller with nowhere to put the extras simply leaves them out.
 */
export interface DerivePaths {
  audio?: ContentPath
  poster?: ContentPath
  preview?: ContentPath
  aspect?: ContentPath
  /** Seconds. What `Track.duration` and `MusicalCover.duration` hold. */
  duration?: ContentPath
  /** `m:ss`. What `Performance.runtime` holds. */
  runtime?: ContentPath
}

/**
 * What the dialog is being asked to replace.
 *
 * Two ways to say it, because there are two editors.
 *
 * **By path**, for editing on the page: give the path of the field and, for a
 * video, the paths of everything else one recording fills. The dialog writes
 * them itself, into the live content, and the page updates as it goes.
 *
 * **By callback**, for the panel: give the current value and take the keys back
 * in `onResult`. The panel holds a draft that is only committed on Save, so it
 * has to be the one deciding when its own state changes; a dialog writing
 * through to the store behind it would put an upload on the page while the
 * editor still had the option of discarding it.
 */
export interface MediaTarget {
  kind: MediaKind
  label?: string
  /** What the file picker will accept. Defaults from `kind`. */
  accept?: string
  /** Whether the field is allowed to be empty. */
  clearable?: boolean

  /** Path mode: the field holding the media key. */
  path?: ContentPath
  /** Path mode: the other fields one recording fills. */
  derive?: DerivePaths

  /** Callback mode: what the field holds now. */
  value?: string
  /**
   * The keys, once they are uploaded.
   *
   * Required by callback mode and *also* honoured in path mode, where it is the
   * escape hatch for a derived file whose destination is not a field that can
   * simply be written. A performance's soundtrack is the case that needs it: it
   * lives on a `Track` inside a list, so an extracted mp3 either updates the
   * first track or has to make one, and only the caller knows how to build a
   * whole track. See WorkDetail.
   */
  onResult?: (result: MediaResult) => void
  /**
   * Which derivations to offer, when `derive` does not say.
   *
   * In path mode the presence of a path is the offer; this adds the ones whose
   * destination is handled by `onResult` instead.
   */
  deriveKinds?: DeriveKind[]
}

const ACCEPTS: Record<MediaKind, string> = {
  video: 'video/*',
  preview: 'video/*',
  audio: 'audio/*',
  poster: 'image/*',
  cover: 'image/*',
  portrait: 'image/*',
  image: 'image/*',
}

type Phase = 'choose' | 'working' | 'error'

const STAGE_WORDS: Record<Stage, string> = {
  reading: 'Reading the file',
  loading: `Loading the video tools (${FFMPEG_DOWNLOAD_MB} MB, once)`,
  audio: 'Extracting the audio',
  preview: 'Cutting the preview loop',
  poster: 'Taking a still',
}

/**
 * Replacing a picture, a film or a recording.
 *
 * The part worth reading is `runVideo`. Everything else here is a file picker.
 *
 * Dropping a video on this does what `scripts/ingest-video.mjs` does at a
 * terminal: it lifts the soundtrack out as an mp3, takes a still from a third of
 * the way in, optionally cuts the short silent loop the archive wall hovers
 * with, measures the shape and the length — and then writes all of it into the
 * content in one go, at new keys. New keys are not incidental: the bucket serves
 * media with a year-long immutable cache header, so *replacing* a file in place
 * would change nothing any browser would ever look at again. Replacing a video
 * here means the content points somewhere new, which is the only kind of
 * replacement that is visible.
 *
 * Every derivation is allowed to fail on its own. A file this browser cannot
 * decode still uploads; it just arrives without the extras, and says so.
 */
export function MediaDialog({
  target,
  onClose,
}: {
  target: MediaTarget
  onClose: () => void
}) {
  const content = useSiteContent()
  const { commit, read, say } = useEdit()

  const current = target.path
    ? String(read(target.path) ?? '')
    : (target.value ?? '')

  const [phase, setPhase] = useState<Phase>('choose')
  const [stage, setStage] = useState<string>('')
  const [fraction, setFraction] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [urlDraft, setUrlDraft] = useState(current)
  const [status, setStatus] = useState<UploadStatus | null>(null)

  const isVideo = target.kind === 'video' || target.kind === 'preview'
  /** Whether this call has anywhere to put a given derivation. */
  const offers = useCallback(
    (kind: DeriveKind) =>
      Boolean(target.derive?.[kind]) || Boolean(target.deriveKinds?.includes(kind)),
    [target],
  )

  const [wantAudio, setWantAudio] = useState(() => offers('audio'))
  const [wantPreview, setWantPreview] = useState(() => offers('preview'))
  const [wantPoster, setWantPoster] = useState(() => offers('poster'))

  const abortRef = useRef<AbortController | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    void uploadStatus().then(setStatus)
  }, [])

  // Escape closes, unless work is in flight — cancelling an upload halfway is
  // the button below, deliberately, so it cannot happen by reflex. Captured, so
  // the site's own Escape handlers do not also fire.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (phase !== 'working') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase, onClose])

  const password = content.admin.password
  const label = target.label ?? (target.path ? fieldLabel(target.path) : target.kind)

  /**
   * Hand the result to whichever kind of caller this is.
   *
   * In path mode each field is written as its file lands, not all at the end: an
   * upload that fails on the third of four files has still genuinely replaced
   * the first two, and the content should say so.
   */
  const deliver = useCallback(
    (result: MediaResult) => {
      const paths = target.derive
      if (target.path) {
        commit(target.path, result.key)
        if (paths) {
          if (paths.aspect && result.aspect) commit(paths.aspect, result.aspect)
          if (paths.duration && result.duration) commit(paths.duration, result.duration)
          if (paths.runtime && result.runtime) commit(paths.runtime, result.runtime)
          if (paths.audio && result.audio) commit(paths.audio, result.audio)
          if (paths.poster && result.poster) commit(paths.poster, result.poster)
          if (paths.preview && result.preview) commit(paths.preview, result.preview)
        }
      }
      // Always, and after the paths: a caller in path mode may still be the only
      // one that knows where a derived file really belongs.
      target.onResult?.(result)
    },
    [commit, target],
  )

  /** Send one blob and return the media key, or throw with a reason. */
  const send = useCallback(
    async (blob: Blob, kind: MediaKind, filename: string, extension?: string) => {
      setStage(`Uploading the ${kind === 'poster' ? 'still' : kind}`)
      setFraction(0)
      const result = await uploadMedia(blob, {
        kind,
        filename,
        password,
        extension,
        onProgress: setFraction,
        signal: abortRef.current?.signal,
      })
      if (!result.ok) throw new Error(result.error)
      return result.key
    },
    [password],
  )

  /**
   * A video, and everything that comes out of it.
   *
   * Order matters in one place: the film goes up first. It is the biggest file
   * and the one the editor is actually waiting for, so if the connection dies
   * halfway through the extras, the field already points at a real recording
   * rather than at nothing.
   */
  const runVideo = useCallback(
    async (file: File) => {
      let derived: Derived
      try {
        derived = await deriveFromVideo(file, {
          audio: wantAudio && offers('audio'),
          preview: wantPreview && offers('preview'),
          poster: wantPoster && offers('poster'),
          onStage: (s, f) => {
            setStage(STAGE_WORDS[s])
            setFraction(f)
          },
        })
      } catch (err) {
        throw new Error(
          `Could not read that video: ${err instanceof Error ? err.message : 'unknown error'}`,
        )
      }
      setNotes(derived.notes)

      const result: MediaResult = { key: await send(file, target.kind, file.name) }
      if (derived.aspect) result.aspect = derived.aspect
      if (derived.duration) {
        result.duration = Math.round(derived.duration)
        result.runtime = runtimeFrom(derived.duration)
      }
      // Delivered once now so the field points at the film even if a later
      // upload fails, and again below with whatever else arrived.
      deliver(result)

      if (derived.audio) result.audio = await send(derived.audio, 'audio', file.name, 'mp3')
      if (derived.poster) result.poster = await send(derived.poster, 'poster', file.name, 'jpg')
      if (derived.preview) {
        result.preview = await send(derived.preview, 'preview', `${file.name}-loop`, 'mp4')
      }
      if (result.audio || result.poster || result.preview) deliver(result)
    },
    [deliver, offers, send, target.kind, wantAudio, wantPreview, wantPoster],
  )

  const accept = async (file: File) => {
    abortRef.current = new AbortController()
    setPhase('working')
    setError(null)
    setNotes([])
    try {
      if (isVideo) await runVideo(file)
      else deliver({ key: await send(file, target.kind, file.name) })
      say({ tone: 'ok', text: `${label} replaced.` })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('error')
    } finally {
      abortRef.current = null
    }
  }

  const useUrl = () => {
    const value = urlDraft.trim()
    // Absolute URLs pass through `mediaUrl` untouched; a key has to start at the
    // root, since that is what gets appended to the bucket's hostname.
    if (value && !/^(https?:)?\/\//.test(value) && !value.startsWith('/')) {
      setError('A key has to start with a slash, like /media/covers/name.jpg.')
      return
    }
    deliver({ key: value })
    say({ tone: 'ok', text: `${label} updated.` })
    onClose()
  }

  return (
    <div
      className="edit-chrome fixed inset-0 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Replace ${label}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== 'working') onClose()
      }}
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-white/12 bg-neutral-950 p-6 text-neutral-200 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.62rem] tracking-[0.28em] text-neutral-500 uppercase">
              Replace
            </p>
            <h2 className="mt-1 truncate text-sm tracking-[0.12em] text-white uppercase">
              {label}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={phase === 'working'}
            className="shrink-0 rounded-sm border border-white/15 px-3 py-1.5 text-[0.62rem] tracking-[0.18em] text-neutral-300 uppercase transition-colors hover:border-white/45 hover:text-white disabled:opacity-30"
          >
            Close
          </button>
        </div>

        {/* ---------------- what is there now ---------------- */}
        <div className="mt-6 flex items-center gap-4 rounded-sm border border-white/10 bg-black/40 p-3">
          <Preview value={current} kind={target.kind} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] tracking-[0.18em] text-neutral-500 uppercase">
              Now
            </p>
            <p className="mt-1 truncate font-mono text-xs text-neutral-300">
              {current || 'empty'}
            </p>
          </div>
          {target.clearable && current && phase !== 'working' && (
            <button
              type="button"
              onClick={() => {
                deliver({ key: '' })
                onClose()
              }}
              className="shrink-0 rounded-sm border border-white/15 px-3 py-1.5 text-[0.62rem] tracking-[0.18em] text-neutral-400 uppercase transition-colors hover:border-red-500/60 hover:text-red-400"
            >
              Clear
            </button>
          )}
        </div>

        {phase === 'working' ? (
          <Working
            stage={stage}
            fraction={fraction}
            onCancel={() => abortRef.current?.abort()}
          />
        ) : (
          <>
            {/* ---------------- derivations ---------------- */}
            {isVideo && (offers('audio') || offers('poster') || offers('preview')) && (
              <fieldset className="mt-6 rounded-sm border border-white/10 p-4">
                <legend className="px-2 text-[0.62rem] tracking-[0.18em] text-neutral-400 uppercase">
                  From the video
                </legend>
                <p className="text-[0.72rem] leading-relaxed text-neutral-500">
                  Done here in the browser, before anything is uploaded. The first
                  one loads about {FFMPEG_DOWNLOAD_MB} MB of video tools
                  {ffmpegReady() ? ' — already loaded in this tab.' : '.'}
                </p>
                <div className="mt-3 space-y-2">
                  {offers('audio') && (
                    <Check
                      checked={wantAudio}
                      onChange={setWantAudio}
                      label="Extract the audio"
                      hint="An mp3 of the whole soundtrack, for the listening shelf and the waveform player."
                    />
                  )}
                  {offers('poster') && (
                    <Check
                      checked={wantPoster}
                      onChange={setWantPoster}
                      label="Take a still"
                      hint="One frame from a third of the way in — past the walk-on, before the applause."
                    />
                  )}
                  {offers('preview') && (
                    <Check
                      checked={wantPreview}
                      onChange={setWantPreview}
                      label="Cut the preview loop"
                      hint="Eight silent seconds at 480px, for the hover on the archive wall. Slowest of the three."
                    />
                  )}
                </div>
              </fieldset>
            )}

            {/* ---------------- the drop ---------------- */}
            <Drop
              accept={target.accept ?? ACCEPTS[target.kind]}
              disabled={status ? !status.configured : false}
              onFile={accept}
            />

            {status && !status.configured && (
              <p className="mt-3 rounded-sm border border-amber-500/30 bg-amber-500/5 p-3 text-[0.72rem] leading-relaxed text-amber-200/90">
                {status.unavailable ??
                  `Uploading is not set up on this deployment (missing ${status.missing.join(', ')}). See EDITING.md.`}{' '}
                You can still point this field at a file that is already in the
                bucket, or at any URL.
              </p>
            )}

            {/* ---------------- or a path ---------------- */}
            <div className="mt-6">
              <label
                htmlFor="media-url"
                className="block text-[0.62rem] tracking-[0.18em] text-neutral-400 uppercase"
              >
                Or a key / URL
              </label>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-neutral-500">
                A key like <code className="text-neutral-400">/media/covers/x.jpg</code>{' '}
                resolves to the bucket in production and to public/ in
                development. An https:// address is used exactly as written.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  id="media-url"
                  type="text"
                  value={urlDraft}
                  onChange={(e) => {
                    setUrlDraft(e.target.value)
                    setError(null)
                  }}
                  placeholder="/media/posters/example.jpg"
                  className="min-w-0 flex-1 rounded-sm border border-white/12 bg-black/35 px-3 py-2 font-mono text-xs text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-white/45"
                />
                <button
                  type="button"
                  onClick={useUrl}
                  className="shrink-0 rounded-sm border border-white bg-white px-4 py-2 text-[0.62rem] tracking-[0.18em] text-black uppercase transition-opacity hover:opacity-85"
                >
                  Use
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-sm border border-red-500/30 bg-red-500/5 p-3 text-[0.75rem] leading-relaxed text-red-300"
          >
            {error}
          </p>
        )}

        {notes.length > 0 && (
          <ul className="mt-4 space-y-2">
            {notes.map((note) => (
              <li
                key={note}
                className="rounded-sm border border-amber-500/25 bg-amber-500/5 p-3 text-[0.72rem] leading-relaxed text-amber-200/90"
              >
                {note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- pieces ------------------------------- */

function Preview({ value, kind }: { value: string; kind: MediaKind }) {
  const resolved = mediaUrl(value)
  const isImage =
    kind === 'poster' || kind === 'cover' || kind === 'portrait' || kind === 'image'
  return (
    <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-black">
      {!value ? (
        <span className="text-[0.6rem] text-neutral-600">empty</span>
      ) : isImage ? (
        <img
          src={resolved}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden'
          }}
        />
      ) : kind === 'audio' ? (
        <span className="text-[0.58rem] tracking-widest text-neutral-500 uppercase">
          audio
        </span>
      ) : (
        <video
          src={resolved}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-white"
      />
      <span>
        <span className="text-sm text-neutral-200">{label}</span>
        <span className="block text-[0.72rem] leading-snug text-neutral-500">
          {hint}
        </span>
      </span>
    </label>
  )
}

/** The drop zone, which is also a button, because a drop is not discoverable. */
function Drop({
  accept,
  disabled,
  onFile,
}: {
  accept: string
  disabled: boolean
  onFile: (file: File) => void
}) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) onFile(file)
        }}
        className={`w-full rounded-sm border border-dashed px-6 py-10 text-center transition-colors ${
          disabled
            ? 'cursor-not-allowed border-white/10 opacity-40'
            : over
              ? 'border-sky-400 bg-sky-400/10'
              : 'border-white/20 hover:border-white/45'
        }`}
      >
        <span className="block text-sm text-neutral-200">
          Drop a file here, or click to choose one
        </span>
        <span className="mt-1 block text-[0.72rem] text-neutral-500">{accept}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared so choosing the same file twice in a row still fires.
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </div>
  )
}

function Working({
  stage,
  fraction,
  onCancel,
}: {
  stage: string
  fraction: number | null
  onCancel: () => void
}) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-neutral-200">{stage || 'Working'}…</p>
        <p className="font-mono text-xs text-neutral-500">
          {fraction === null ? '' : `${Math.round(fraction * 100)}%`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={stage}
        aria-valuenow={fraction === null ? undefined : Math.round(fraction * 100)}
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={`h-full bg-white transition-[width] duration-200 ${
            fraction === null ? 'w-1/3 animate-pulse' : ''
          }`}
          style={fraction === null ? undefined : { width: `${fraction * 100}%` }}
        />
      </div>
      <p className="mt-3 text-[0.72rem] leading-relaxed text-neutral-500">
        Keep this tab open. Extracting audio from a long recording takes a while —
        it is being done here rather than on a server, so the file only has to
        travel once.
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 rounded-sm border border-white/15 px-3 py-1.5 text-[0.62rem] tracking-[0.18em] text-neutral-400 uppercase transition-colors hover:border-red-500/60 hover:text-red-400"
      >
        Cancel
      </button>
    </div>
  )
}
