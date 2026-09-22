import type { PortraitCopy, Testimonial, UiCopy } from '@/types/content'
import {
  Color,
  Group,
  MediaField,
  Repeater,
  Row,
  StringList,
  Text,
  TextArea,
} from '@/components/admin/fields'

/**
 * The About page: its opening film and statement, the portrait column, and the
 * testimonial run.
 *
 * Kept as one tab rather than three because that is how the page reads — the
 * statement leads into the portrait, the portrait into the recordings, the
 * recordings into the quotes — and an editor rewriting the opening usually
 * wants to see what it opens onto.
 */
export function AboutSection({
  portrait,
  onPortraitChange,
  testimonials,
  onTestimonialsChange,
  ui,
  onUiChange,
}: {
  portrait: PortraitCopy
  onPortraitChange: (next: PortraitCopy) => void
  testimonials: Testimonial[]
  onTestimonialsChange: (next: Testimonial[]) => void
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
            hint="Media files are cached for a year once served. A re-cut has to arrive under a new filename or browsers keep showing the old one."
          />
          <MediaField
            label="First frame"
            value={ui.about.filmPoster}
            onChange={(v) =>
              onUiChange({ ...ui, about: { ...ui.about, filmPoster: v } })
            }
          />
        </Row>
      </Group>

      <Group
        title="Portrait column"
        description="The words beside the microphone. The lead paragraph carries the section; each beat below it is a heading whose final word the page reverses out."
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

      <Group
        title="Testimonials"
        description="The horizontal run at the foot of the page. Three cards are over before a reader has understood that scrolling is what moves them, so five is the working minimum."
      >
        <Text
          label="Section heading"
          value={ui.testimonials.heading}
          onChange={(v) =>
            onUiChange({ ...ui, testimonials: { heading: v } })
          }
          hint="The huge word the cards travel across."
        />
        <Repeater
          label="Cards"
          items={testimonials}
          onChange={onTestimonialsChange}
          blank={(): Testimonial => ({
            source: '',
            role: '',
            context: '',
            quote: '',
            portrait: '',
            accent: '#f2b13c',
          })}
          addLabel="Add card"
          title={(item) => item.source || 'Untitled card'}
          render={(item, setItem) => (
            <div className="space-y-4">
              <Row>
                <Text
                  label="Who is speaking"
                  value={item.source}
                  onChange={(v) => setItem({ ...item, source: v })}
                />
                <Text
                  label="Who they are"
                  value={item.role}
                  onChange={(v) => setItem({ ...item, role: v })}
                  hint="The grey line under the name."
                />
              </Row>
              <Text
                label="Context"
                value={item.context}
                onChange={(v) => setItem({ ...item, context: v })}
                hint="The small label inside the card — the night, the run, the record."
              />
              <TextArea
                label="Quote"
                rows={4}
                value={item.quote}
                onChange={(v) => setItem({ ...item, quote: v })}
              />
              <Row>
                <MediaField
                  label="Still"
                  value={item.portrait}
                  onChange={(v) => setItem({ ...item, portrait: v })}
                  hint="Sits in the record’s label. A full https:// URL also works."
                />
                <Color
                  label="Rim colour"
                  value={item.accent}
                  onChange={(v) => setItem({ ...item, accent: v })}
                  hint="The two-pixel edge, and nothing else on the card."
                />
              </Row>
              <Text
                label="Focus"
                mono
                value={item.focus ?? ''}
                onChange={(v) =>
                  setItem({ ...item, focus: v || undefined })
                }
                hint="Optional object-position for the still, e.g. “50% 20%”. Leave empty to centre it."
              />
            </div>
          )}
        />
      </Group>
    </div>
  )
}
