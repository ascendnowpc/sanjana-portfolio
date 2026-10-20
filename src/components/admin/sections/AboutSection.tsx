import type { PortraitCopy, UiCopy } from '@/types/content'
import {
  Group,
  MediaField,
  Repeater,
  Row,
  StringList,
  Text,
  TextArea,
} from '@/components/admin/fields'

/**
 * The About page: its opening film and statement, and the portrait column.
 *
 * Kept as one tab rather than two because that is how the page reads — the
 * statement leads into the portrait — and an editor rewriting the opening
 * usually wants to see what it opens onto.
 */
export function AboutSection({
  portrait,
  onPortraitChange,
  ui,
  onUiChange,
}: {
  portrait: PortraitCopy
  onPortraitChange: (next: PortraitCopy) => void
  ui: UiCopy
  onUiChange: (next: UiCopy) => void
}) {
  return (
    <div className="space-y-6">
      <Group
        title="The opening"
        description="The statement the page opens on, over a looping film that grows to fill the screen as you scroll."
      >
        <StringList
          label="Headline lines"
          hint="One entry per line. The break between them is deliberate — at this weight it is part of the composition, so it is authored rather than left to the window width."
          items={ui.about.headline}
          addLabel="Add line"
          onChange={(v) =>
            onUiChange({ ...ui, about: { ...ui.about, headline: v } })
          }
        />
        <Row>
          <MediaField
            label="Film"
            kind="video"
            value={ui.about.film}
            onChange={(v) =>
              onUiChange({ ...ui, about: { ...ui.about, film: v } })
            }
            upload={{
              kind: 'video',
              deriveKinds: ['poster'],
              // The still comes off the film, so the field beside this one fills
              // itself — and both land at new keys, which is the only way a
              // re-cut is ever seen. See the hint.
              onResult: (result) =>
                onUiChange({
                  ...ui,
                  about: {
                    ...ui.about,
                    film: result.key,
                    filmPoster: result.poster ?? ui.about.filmPoster,
                  },
                }),
            }}
            hint="Media files are cached for a year once served, so every upload lands under a new filename — which is what makes a re-cut visible at all."
          />
          <MediaField
            label="First frame"
            value={ui.about.filmPoster}
            onChange={(v) =>
              onUiChange({ ...ui, about: { ...ui.about, filmPoster: v } })
            }
            upload={{ kind: 'poster' }}
          />
        </Row>
      </Group>

      <Group
        title="Portrait column"
        description="The words beside the microphone. The lead paragraph carries the section; each beat below it is a heading whose final word the page reverses out. In the lead and the bodies, wrap a phrase in asterisks — *like this* — to set it in brass."
      >
        <TextArea
          label="Lead paragraph"
          rows={5}
          value={portrait.lead}
          onChange={(v) => onPortraitChange({ ...portrait, lead: v })}
        />
        <Repeater
          label="Beats"
          items={portrait.beats}
          onChange={(v) => onPortraitChange({ ...portrait, beats: v })}
          blank={() => ({ heading: '', accent: '', body: '' })}
          addLabel="Add beat"
          title={(item) =>
            `${item.heading} ${item.accent}`.trim() || 'Untitled beat'
          }
          copy={(item) => structuredClone(item)}
          render={(item, setItem) => (
            <div className="space-y-4">
              <Row>
                <Text
                  label="Heading"
                  value={item.heading}
                  onChange={(v) => setItem({ ...item, heading: v })}
                  hint="Everything but the final word."
                />
                <Text
                  label="Final word"
                  value={item.accent}
                  onChange={(v) => setItem({ ...item, accent: v })}
                  hint="Reversed out — white ground, dark type. Put the word carrying the fact here, never a preposition."
                />
              </Row>
              <TextArea
                label="Body"
                rows={5}
                value={item.body}
                onChange={(v) => setItem({ ...item, body: v })}
              />
            </div>
          )}
        />
      </Group>

    </div>
  )
}
