import type {
  HomeNavToken,
  HomeToken,
  NavLinkCopy,
  UiCopy,
} from '@/types/content'
import {
  Group,
  Num,
  Repeater,
  Row,
  Select,
  StringList,
  Text,
  TextArea,
} from '@/components/admin/fields'

/**
 * Every fixed word on the site that is not somebody's name or a piece of work.
 *
 * Headings, buttons, filter keys, form labels, the sentence the index opens
 * on, the seven words of the sound question, and the labels a screen reader
 * reads instead of an icon. If it is on the page and it is not content, it is
 * here.
 *
 * Grouped by where it is read rather than by what it is, because that is how
 * somebody will look for it: they are on a page, they can see the word, and
 * they want the box that holds it.
 */
export function CopySection({
  value,
  onChange,
}: {
  value: UiCopy
  onChange: (next: UiCopy) => void
}) {
  /** Write one top-level group of the copy. */
  function put<K extends keyof UiCopy>(key: K, v: UiCopy[K]) {
    onChange({ ...value, [key]: v })
  }
  /** Write one field inside a group, which is most edits here. */
  function field<K extends keyof UiCopy, F extends keyof UiCopy[K]>(
    key: K,
    name: F,
  ) {
    return (v: UiCopy[K][F]) => put(key, { ...value[key], [name]: v })
  }

  return (
    <div className="space-y-6">
      <Group
        title="Browser tab & search results"
        description="Written into the page as soon as the site loads. The copies in index.html stay as they are — those are what a crawler that runs no JavaScript reads, so carry a change across by hand when one matters."
      >
        <Text
          label="Page title"
          value={value.meta.title}
          onChange={field('meta', 'title')}
        />
        <TextArea
          label="Description"
          rows={2}
          value={value.meta.description}
          onChange={field('meta', 'description')}
        />
        <Text
          label="Theme colour"
          mono
          value={value.meta.themeColor}
          onChange={field('meta', 'themeColor')}
          hint="What a phone browser paints its own chrome with."
        />
      </Group>

      <Group
        title="Top bar"
        description="The wordmark beside these keys is the name on the Profile tab."
      >
        <LinkList
          label="Sections"
          items={value.nav.sections}
          onChange={(v) => put('nav', { ...value.nav, sections: v })}
        />
        <Row>
          <Text
            label="Call to action — label"
            value={value.nav.cta.label}
            onChange={(v) =>
              put('nav', { ...value.nav, cta: { ...value.nav.cta, label: v } })
            }
            hint="The one key that is always lit, whichever page you are on."
          />
          <Text
            label="Call to action — path"
            mono
            value={value.nav.cta.to}
            onChange={(v) =>
              put('nav', { ...value.nav, cta: { ...value.nav.cta, to: v } })
            }
          />
        </Row>
        <Row>
          <Text
            label="Open menu (spoken)"
            value={value.nav.openMenu}
            onChange={field('nav', 'openMenu')}
            hint="Read aloud in place of the hamburger icon on a phone."
          />
          <Text
            label="Close menu (spoken)"
            value={value.nav.closeMenu}
            onChange={field('nav', 'closeMenu')}
          />
        </Row>
      </Group>

      <Group
        title="Front page"
        description="The sentence that greets a visitor while the room is still far away, and the sentence at the foot of it that never leaves."
      >
        <WelcomeEditor
          lines={value.home.welcome}
          onChange={(v) => put('home', { ...value.home, welcome: v })}
        />
        <HomeNavEditor
          lines={value.home.nav}
          onChange={(v) => put('home', { ...value.home, nav: v })}
        />
        <Row>
          <Text
            label="Drift hint"
            value={value.home.driftHint}
            onChange={field('home', 'driftHint')}
            hint="The line at the bottom right, telling a visitor what moves the room."
          />
          <Text
            label="Hidden index heading"
            value={value.home.srHeading}
            onChange={field('home', 'srHeading')}
            hint="Heads the plain list of every piece that only a screen reader meets."
          />
        </Row>
      </Group>

      <Group
        title="The sound question"
        description="Asked once a visit, before anything has started. Each word carries its own size and its own fall, which is what lays the sentence diagonally across the screen instead of stacking it."
      >
        <Repeater
          label="Words"
          items={value.soundGate.words}
          onChange={(v) => put('soundGate', { ...value.soundGate, words: v })}
          blank={() => ({ word: '', size: 0.9, drop: 0 })}
          addLabel="Add word"
          title={(item) => item.word || 'Word'}
          copy={(item) => ({ ...item })}
          render={(item, setItem) => (
            <div className="grid gap-4 md:grid-cols-3">
              <Text
                label="Word"
                value={item.word}
                onChange={(v) => setItem({ ...item, word: v })}
              />
              <Num
                label="Size"
                step={0.01}
                value={item.size}
                onChange={(v) => setItem({ ...item, size: v })}
                hint="A multiple of the run’s own size."
              />
              <Num
                label="Drop"
                step={0.05}
                value={item.drop}
                onChange={(v) => setItem({ ...item, drop: v })}
                hint="How far below the first word it sits, in lines."
              />
            </div>
          )}
        />
        <Row>
          <Text
            label="Accept (spoken)"
            value={value.soundGate.enterLabel}
            onChange={field('soundGate', 'enterLabel')}
            hint="The whole panel is the yes, so this is what a screen reader is told it does."
          />
          <Text
            label="Decline"
            value={value.soundGate.decline}
            onChange={field('soundGate', 'decline')}
          />
        </Row>
        <Row>
          <Text
            label="Speaker — turn on (spoken)"
            value={value.sound.turnOn}
            onChange={field('sound', 'turnOn')}
            hint="The speaker in the bottom-left corner of every page is an icon, so this is what a screen reader is told it does while the music is off."
          />
          <Text
            label="Speaker — turn off (spoken)"
            value={value.sound.turnOff}
            onChange={field('sound', 'turnOff')}
            hint="The same, while the music is on."
          />
        </Row>
      </Group>

      <Group title="Archive page">
        <Row>
          <Text
            label="Hidden page title"
            value={value.work.srTitle}
            onChange={field('work', 'srTitle')}
            hint="The page shows no heading of its own; this is what a screen reader arrives at."
          />
          <Text
            label="“All” filter"
            value={value.work.allFilter}
            onChange={field('work', 'allFilter')}
          />
        </Row>
        <Row>
          <Text
            label="Grid view"
            value={value.work.gridView}
            onChange={field('work', 'gridView')}
          />
          <Text
            label="List view"
            value={value.work.listView}
            onChange={field('work', 'listView')}
          />
        </Row>
        <Row>
          <Text
            label="Filter group (spoken)"
            value={value.work.filterLabel}
            onChange={field('work', 'filterLabel')}
          />
          <Text
            label="View group (spoken)"
            value={value.work.viewLabel}
            onChange={field('work', 'viewLabel')}
          />
        </Row>
        <Text
          label="Empty state"
          value={value.work.empty}
          onChange={field('work', 'empty')}
        />
      </Group>

      <Group
        title="Performance page"
        description="Anything written {like this} is a slot the page fills in — leave it where it is unless you mean to drop the value it stands for."
      >
        <Row>
          <Text
            label="Jump link"
            value={value.workDetail.moreInfo}
            onChange={field('workDetail', 'moreInfo')}
          />
          <Text
            label="No footage yet"
            value={value.workDetail.noFootage}
            onChange={field('workDetail', 'noFootage')}
          />
        </Row>
        <Row>
          <Text
            label="Credits heading"
            value={value.workDetail.credits}
            onChange={field('workDetail', 'credits')}
          />
          <Text
            label="Stills heading"
            value={value.workDetail.stills}
            onChange={field('workDetail', 'stills')}
          />
        </Row>
        <Row>
          <Text
            label="Previous"
            value={value.workDetail.previous}
            onChange={field('workDetail', 'previous')}
          />
          <Text
            label="Next"
            value={value.workDetail.next}
            onChange={field('workDetail', 'next')}
          />
        </Row>
        <Row>
          <Text
            label="Listen"
            value={value.workDetail.listen}
            onChange={field('workDetail', 'listen')}
            hint="Used when the piece has no venue."
          />
          <Text
            label="Listen, with a venue"
            value={value.workDetail.listenAt}
            onChange={field('workDetail', 'listenAt')}
            hint="{venue}"
          />
        </Row>
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['year', 'Year'],
              ['venue', 'Venue'],
              ['city', 'City'],
              ['role', 'Role'],
              ['runtime', 'Runtime'],
              ['recording', 'Recording'],
            ] as const
          ).map(([key, label]) => (
            <Text
              key={key}
              label={`Detail — ${label}`}
              value={value.workDetail.meta[key]}
              onChange={(v) =>
                put('workDetail', {
                  ...value.workDetail,
                  meta: { ...value.workDetail.meta, [key]: v },
                })
              }
            />
          ))}
        </div>
        <Row>
          <Text
            label="Play (spoken)"
            value={value.workDetail.playLabel}
            onChange={field('workDetail', 'playLabel')}
            hint="{title}"
          />
          <Text
            label="Jump to recording (spoken)"
            value={value.workDetail.jumpLabel}
            onChange={field('workDetail', 'jumpLabel')}
          />
        </Row>
        <Text
          label="Still description"
          value={value.workDetail.stillAlt}
          onChange={field('workDetail', 'stillAlt')}
          hint="{title}, {n}"
        />
      </Group>

      <Group title="About page — labels">
        <Row>
          <Text
            label="Portrait eyebrow"
            value={value.portrait.label}
            onChange={field('portrait', 'label')}
          />
          <Text
            label="Portrait loading"
            value={value.portrait.loading}
            onChange={field('portrait', 'loading')}
            hint="{percent}"
          />
        </Row>
        <Text
          label="Portrait description"
          value={value.about.portraitAlt}
          onChange={field('about', 'portraitAlt')}
          hint="{name}, {n} — read aloud in place of each photograph."
        />
        <Row>
          <Text
            label="Shelf key — recordings"
            value={value.about.shelfTabs.recordings}
            onChange={(v) =>
              put('about', {
                ...value.about,
                shelfTabs: { ...value.about.shelfTabs, recordings: v },
              })
            }
            hint="The first of the two keys over the listening shelf."
          />
          <Text
            label="Shelf key — covers"
            value={value.about.shelfTabs.covers}
            onChange={(v) =>
              put('about', {
                ...value.about,
                shelfTabs: { ...value.about.shelfTabs, covers: v },
              })
            }
            hint="The second. Hidden from visitors until there is a cover behind it."
          />
        </Row>
      </Group>

      <Group
        title="Musical covers"
        description="The second key of the About page's shelf. The covers themselves are on their own tab; these are the words around them."
      >
        <Row>
          <Text
            label="Section heading"
            value={value.covers.heading}
            onChange={field('covers', 'heading')}
          />
          <Text
            label="Nothing there yet"
            value={value.covers.empty}
            onChange={field('covers', 'empty')}
            hint="Only ever seen while editing — a visitor is not shown the key at all until there is something behind it."
          />
        </Row>
        <Row>
          <Text
            label="Under the title"
            value={value.covers.original}
            onChange={field('covers', 'original')}
            hint="{artist} — whose song it is."
          />
          <Text
            label="Open the film"
            value={value.covers.watch}
            onChange={field('covers', 'watch')}
          />
        </Row>
        <Row>
          <Text
            label="Close the film"
            value={value.covers.closeVideo}
            onChange={field('covers', 'closeVideo')}
          />
          <Text
            label="Film (spoken)"
            value={value.covers.videoLabel}
            onChange={field('covers', 'videoLabel')}
            hint="{title}"
          />
        </Row>
      </Group>

      <Group
        title="Listening shelf"
        description="The cards on the About page and their transport controls."
      >
        <Row>
          <Text
            label="Section heading"
            value={value.music.heading}
            onChange={field('music', 'heading')}
          />
          <Text
            label="Link out of a card"
            value={value.music.watch}
            onChange={field('music', 'watch')}
          />
        </Row>
        <Row>
          <Text
            label="One recording"
            value={value.music.recording}
            onChange={field('music', 'recording')}
          />
          <Text
            label="Several recordings"
            value={value.music.recordings}
            onChange={field('music', 'recordings')}
          />
        </Row>
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['play', 'Play'],
              ['pause', 'Pause'],
              ['previous', 'Previous'],
              ['next', 'Next'],
              ['volume', 'Volume'],
              ['mute', 'Mute'],
              ['unmute', 'Unmute'],
              ['showList', 'Show list'],
              ['hideList', 'Hide list'],
            ] as const
          ).map(([key, label]) => (
            <Text
              key={key}
              label={`${label} (spoken)`}
              value={value.music[key]}
              onChange={field('music', key)}
            />
          ))}
        </div>
        <Row>
          <Text
            label="Seek (spoken)"
            value={value.music.seek}
            onChange={field('music', 'seek')}
            hint="{title}"
          />
          <Text
            label="Open card (spoken)"
            value={value.music.openLabel}
            onChange={field('music', 'openLabel')}
            hint="{album}"
          />
        </Row>
        <TextArea
          label="Audio missing"
          rows={2}
          value={value.music.audioMissing}
          onChange={field('music', 'audioMissing')}
          hint="Shown on a card whose recording is not on the media host yet."
        />
      </Group>

      <Group
        title="Recording player"
        description="The waveform player on a performance page."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['listen', 'Default heading'],
              ['play', 'Play'],
              ['pause', 'Pause'],
              ['previous', 'Previous'],
              ['next', 'Next'],
              ['volume', 'Volume'],
              ['volumeShort', 'Volume, short'],
            ] as const
          ).map(([key, label]) => (
            <Text
              key={key}
              label={label}
              value={value.player[key]}
              onChange={field('player', key)}
            />
          ))}
        </div>
        <TextArea
          label="No recording attached"
          rows={3}
          value={value.player.demoNote}
          onChange={field('player', 'demoNote')}
          hint="Shown when a track has no audio file and the player is sounding a test tone instead."
        />
      </Group>

      <Group title="Contact page">
        <Row>
          <Text
            label="Eyebrow"
            value={value.contact.eyebrow}
            onChange={field('contact', 'eyebrow')}
          />
          <Text
            label="Heading"
            value={value.contact.heading}
            onChange={field('contact', 'heading')}
          />
        </Row>
        <Text
          label="Enquiry type legend"
          value={value.contact.enquiryLegend}
          onChange={field('contact', 'enquiryLegend')}
        />
        <StringList
          label="Enquiry types"
          items={value.contact.enquiryTypes}
          addLabel="Add type"
          onChange={(v) => put('contact', { ...value.contact, enquiryTypes: v })}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ['name', 'Name field'],
              ['email', 'Email field'],
              ['date', 'Date field'],
              ['message', 'Message field'],
            ] as const
          ).map(([key, label]) => (
            <Text
              key={key}
              label={label}
              value={value.contact.fields[key]}
              onChange={(v) =>
                put('contact', {
                  ...value.contact,
                  fields: { ...value.contact.fields, [key]: v },
                })
              }
            />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Text
            label="Submit"
            value={value.contact.submit}
            onChange={field('contact', 'submit')}
          />
          <Text
            label="Sending"
            value={value.contact.sending}
            onChange={field('contact', 'sending')}
          />
          <Text
            label="Sent"
            value={value.contact.sent}
            onChange={field('contact', 'sent')}
          />
        </div>
        <TextArea
          label="Note after sending"
          rows={3}
          value={value.contact.demoNote}
          onChange={field('contact', 'demoNote')}
          hint="The form has no back end yet — this is what it says so. Rewrite it when one is wired up."
        />
        <div className="grid gap-4 md:grid-cols-4">
          {(
            [
              ['bookingLabel', 'Booking'],
              ['generalLabel', 'General'],
              ['elsewhereLabel', 'Elsewhere'],
              ['basedLabel', 'Based in'],
            ] as const
          ).map(([key, label]) => (
            <Text
              key={key}
              label={label}
              value={value.contact[key]}
              onChange={field('contact', key)}
            />
          ))}
        </div>
      </Group>

      <Group title="Footer">
        <Row>
          <Text
            label="Links heading"
            value={value.footer.siteHeading}
            onChange={field('footer', 'siteHeading')}
          />
          <Text
            label="Elsewhere heading"
            value={value.footer.elsewhereHeading}
            onChange={field('footer', 'elsewhereHeading')}
          />
        </Row>
        <LinkList
          label="Links"
          items={value.footer.links}
          onChange={(v) => put('footer', { ...value.footer, links: v })}
        />
        <Row>
          <Text
            label="Copyright"
            value={value.footer.copyright}
            onChange={field('footer', 'copyright')}
            hint="{year}, {name}"
          />
          <Text
            label="Rights line"
            value={value.footer.rights}
            onChange={field('footer', 'rights')}
          />
        </Row>
        <Text
          label="Admin link"
          value={value.footer.adminLabel}
          onChange={field('footer', 'adminLabel')}
          hint="The way back in to this panel. Renaming it does not hide it — see the Access tab."
        />
      </Group>

      <Group title="Social link labels">
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['instagram', 'Instagram'],
              ['youtube', 'YouTube'],
              ['spotify', 'Spotify'],
            ] as const
          ).map(([key, label]) => (
            <Text
              key={key}
              label={label}
              value={value.socials[key]}
              onChange={field('socials', key)}
            />
          ))}
        </div>
        <p className="text-[0.7rem] text-neutral-500">
          The addresses these point at live on the Profile tab.
        </p>
      </Group>

      <Group title="Elsewhere">
        <Text
          label="Gallery invitation"
          value={value.gallery.learnMore}
          onChange={field('gallery', 'learnMore')}
          hint="The words that follow the cursor while a frame on the front page is lit."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Text
            label="404 — code"
            value={value.notFound.code}
            onChange={field('notFound', 'code')}
          />
          <Text
            label="404 — heading"
            value={value.notFound.heading}
            onChange={field('notFound', 'heading')}
          />
        </div>
        <TextArea
          label="404 — body"
          rows={2}
          value={value.notFound.body}
          onChange={field('notFound', 'body')}
        />
        <Text
          label="404 — button"
          value={value.notFound.cta}
          onChange={field('notFound', 'cta')}
        />
      </Group>
    </div>
  )
}

/** A list of label-and-path pairs, which both navigations are. */
function LinkList({
  label,
  items,
  onChange,
}: {
  label: string
  items: NavLinkCopy[]
  onChange: (next: NavLinkCopy[]) => void
}) {
  return (
    <Repeater
      label={label}
      items={items}
      onChange={onChange}
      blank={() => ({ to: '/', label: '' })}
      addLabel="Add link"
      title={(item) => item.label || item.to}
      copy={(item) => ({ ...item })}
      render={(item, setItem) => (
        <Row>
          <Text
            label="Label"
            value={item.label}
            onChange={(v) => setItem({ ...item, label: v })}
          />
          <Text
            label="Path"
            mono
            value={item.to}
            onChange={(v) => setItem({ ...item, to: v })}
          />
        </Row>
      )}
    />
  )
}

/**
 * The welcome sentence: lines of words, each word either a display noun or a
 * connective between them.
 *
 * Editing it word by word rather than as a paragraph is not fussiness. The two
 * sizes are what give the sentence its shape, and there is no way to infer
 * from a line of prose which of its words were meant to be the large ones.
 */
function WelcomeEditor({
  lines,
  onChange,
}: {
  lines: HomeToken[][]
  onChange: (next: HomeToken[][]) => void
}) {
  return (
    <Repeater
      label="Welcome sentence"
      hint="One block per line. Write {name} anywhere to drop the name in."
      items={lines}
      onChange={onChange}
      blank={() => [{ kind: 'small' as const, text: '' }]}
      addLabel="Add line"
      title={(line, i) => `Line ${i + 1} — ${line.map((t) => t.text).join(' ')}`}
      count={(line) => `${line.length} word${line.length === 1 ? '' : 's'}`}
      copy={(line) => structuredClone(line)}
      render={(line, setLine) => (
        <Repeater
          items={line}
          onChange={setLine}
          blank={() => ({ kind: 'small' as const, text: '' })}
          addLabel="Add word"
          title={(token) => token.text || 'Word'}
          copy={(token) => ({ ...token })}
          render={(token, setToken) => (
            <Row>
              <Text
                label="Text"
                value={token.text}
                onChange={(v) => setToken({ ...token, text: v })}
              />
              <Select
                label="Size"
                value={token.kind}
                options={[
                  { value: 'big' as const, label: 'Large' },
                  { value: 'small' as const, label: 'Small' },
                ]}
                onChange={(v) => setToken({ ...token, kind: v })}
              />
            </Row>
          )}
        />
      )}
    />
  )
}

/** The sentence at the foot of the index, where some words are the links. */
function HomeNavEditor({
  lines,
  onChange,
}: {
  lines: HomeNavToken[][]
  onChange: (next: HomeNavToken[][]) => void
}) {
  return (
    <Repeater
      label="Bottom sentence"
      hint="The words marked as links are the site’s main navigation on the front page."
      items={lines}
      onChange={onChange}
      blank={() => [{ kind: 'small' as const, text: '' }]}
      addLabel="Add line"
      title={(line, i) => `Line ${i + 1} — ${line.map((t) => t.text).join(' ')}`}
      count={(line) => `${line.length} word${line.length === 1 ? '' : 's'}`}
      copy={(line) => structuredClone(line)}
      render={(line, setLine) => (
        <Repeater
          items={line}
          onChange={setLine}
          blank={() => ({ kind: 'small' as const, text: '' })}
          addLabel="Add word"
          title={(token) => token.text || 'Word'}
          copy={(token) => ({ ...token })}
          render={(token, setToken) => (
            <div className="space-y-4">
              <Row>
                <Text
                  label="Text"
                  value={token.text}
                  onChange={(v) => setToken({ ...token, text: v })}
                />
                <Select
                  label="Kind"
                  value={token.kind}
                  options={[
                    { value: 'link' as const, label: 'Link' },
                    { value: 'small' as const, label: 'Connecting word' },
                  ]}
                  onChange={(v) => setToken({ ...token, kind: v })}
                />
              </Row>
              {token.kind === 'link' && (
                <Text
                  label="Path"
                  mono
                  value={token.to ?? ''}
                  onChange={(v) => setToken({ ...token, to: v })}
                />
              )}
            </div>
          )}
        />
      )}
    />
  )
}
