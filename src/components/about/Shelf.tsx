import { useEffect, useState } from 'react'
import type { Performance } from '@/types/content'
import { useCovers, useUi } from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { Reveal } from '@/components/ui/Reveal'
import { MusicShelf } from '@/components/audio/MusicShelf'
import { CoversShelf } from '@/components/audio/CoversShelf'
import { EditableText } from '@/components/edit/Editable'
import { RegionEdit } from '@/components/edit/ListEdit'

/**
 * The listening band on the About page, under two keys.
 *
 * **Recordings** is the archive, filed by discipline — the shelf that was here
 * before. **Musical covers** is the second collection: songs she did not write.
 * They are separated because they are different claims. A recording of a concert
 * is a performance with a venue and a date behind it; a cover is a song she
 * chose, and the interesting fact about it is whose song it was. Filing the two
 * together would have meant one shelf whose cards did not agree about what a
 * card is.
 *
 * ### Why the second key hides itself
 *
 * A tab with nothing behind it is worse than no tab: it makes a visitor click to
 * find out that there is nothing there. So the keys only appear once there is a
 * second thing to key between — which, on a deploy with no covers yet, means the
 * band looks exactly as it did before any of this was built. In edit mode both
 * are always shown, because otherwise there would be no way in to add the first
 * cover.
 */
export function Shelf({ items }: { items: Performance[] }) {
  const ui = useUi()
  const covers = useCovers()
  const { editing } = useEdit()

  const hasCovers = covers.length > 0
  const showKeys = hasCovers || editing
  const [tab, setTab] = useState<'recordings' | 'covers'>('recordings')

  // Leaving edit mode with nothing on the covers key would strand the visitor
  // on a shelf they cannot see the tabs for.
  useEffect(() => {
    if (tab === 'covers' && !hasCovers && !editing) setTab('recordings')
  }, [tab, hasCovers, editing])

  return (
    /* Narrower than the rest of the page on purpose. The shelf stops growing at
       ~1064px of content, so on a wide screen it sits in the middle with real
       margin either side rather than running the full 1600 — cards that fill a
       1920 display stop reading as record sleeves and start reading as page
       sections. */
    <section className="mx-auto max-w-[1160px] px-6 pt-32 pb-32 md:px-12 md:pt-44">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          {/* The same poster face the page opens on, at a fraction of the size.
              Held small deliberately: at display scale it would compete with the
              sleeves it is labelling, and the job here is to name the shelf, not
              to start a second headline. */}
          <h2
            className="font-[family-name:var(--font-poster)] leading-none tracking-[0.012em] text-chalk uppercase"
            style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}
          >
            {tab === 'recordings' ? (
              <EditableText path={['ui', 'music', 'heading']} value={ui.music.heading} />
            ) : (
              <EditableText path={['ui', 'covers', 'heading']} value={ui.covers.heading} />
            )}
          </h2>

          {showKeys && (
            /* A tablist, properly: the two keys are one control with one tab
               stop, and the arrow keys move between them. A pair of buttons
               would put two stops in the sequence and tell a screen reader
               nothing about which of them is showing. */
            <div
              role="tablist"
              aria-label={ui.music.heading}
              className="flex items-center gap-6"
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                setTab(tab === 'recordings' ? 'covers' : 'recordings')
              }}
            >
              <Key
                selected={tab === 'recordings'}
                onSelect={() => setTab('recordings')}
                id="shelf-recordings"
              >
                <EditableText
                  path={['ui', 'about', 'shelfTabs', 'recordings']}
                  value={ui.about.shelfTabs.recordings}
                />
              </Key>
              <Key
                selected={tab === 'covers'}
                onSelect={() => setTab('covers')}
                id="shelf-covers"
              >
                <EditableText
                  path={['ui', 'about', 'shelfTabs', 'covers']}
                  value={ui.about.shelfTabs.covers}
                />
              </Key>
            </div>
          )}
        </div>
      </Reveal>

      {/* Both panels stay mounted and one is hidden, rather than the unselected
          one being unmounted. A card that is sounding keeps sounding while the
          other key is looked at, which is what somebody comparing two takes
          would expect — and switching back does not restart it. */}
      <div
        role={showKeys ? 'tabpanel' : undefined}
        id="shelf-panel-recordings"
        aria-labelledby={showKeys ? 'shelf-recordings' : undefined}
        hidden={tab !== 'recordings'}
      >
        <MusicShelf items={items} />
        {editing && (
          <div className="mt-8 flex flex-wrap gap-3">
            <RegionEdit drawer="categories" label="Sleeves & disciplines" />
            <RegionEdit drawer="performances" label="The archive" />
          </div>
        )}
      </div>

      <div
        role={showKeys ? 'tabpanel' : undefined}
        id="shelf-panel-covers"
        aria-labelledby={showKeys ? 'shelf-covers' : undefined}
        hidden={tab !== 'covers'}
      >
        <CoversShelf />
      </div>
    </section>
  )
}

/** One of the two keys. Lit is white and a rule under it; unlit is grey. */
function Key({
  selected,
  onSelect,
  id,
  children,
}: {
  selected: boolean
  onSelect: () => void
  id: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={`shelf-panel-${id.replace('shelf-', '')}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`label border-b pb-1 transition-colors duration-300 ${
        selected
          ? 'border-bloom text-chalk'
          : 'border-transparent text-dust hover:text-mist'
      }`}
    >
      {children}
    </button>
  )
}
