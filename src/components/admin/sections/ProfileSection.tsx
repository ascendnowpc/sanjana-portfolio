import type { SiteProfile } from '@/types/content'
import {
  Group,
  Repeater,
  Row,
  StringList,
  Text,
  TextArea,
} from '@/components/admin/fields'

/**
 * The person the site is about.
 *
 * `name` is used in more places than it looks: the wordmark, the preloader,
 * the welcome sentence on the index, the giant word behind the portrait strip
 * and the copyright line all read it, which is exactly why they read it rather
 * than each holding their own copy.
 */
export function ProfileSection({
  value,
  onChange,
}: {
  value: SiteProfile
  onChange: (next: SiteProfile) => void
}) {
  const set = <K extends keyof SiteProfile>(key: K, v: SiteProfile[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="space-y-6">
      <Group
        title="Name & billing"
        description="The name appears in the top bar, on the loading curtain, in the index’s welcome sentence, behind the portrait strip and in the footer’s copyright line. Changing it here changes all of them."
      >
        <Row>
          <Text
            label="Name"
            value={value.name}
            onChange={(v) => set('name', v)}
            hint="Set in capitals on the site’s own faces."
          />
          <Text
            label="Role"
            value={value.role}
            onChange={(v) => set('role', v)}
          />
        </Row>
        <TextArea
          label="Tagline"
          rows={2}
          value={value.tagline}
          onChange={(v) => set('tagline', v)}
          hint="The line under the name in the footer."
        />
        <TextArea
          label="Short bio"
          rows={3}
          value={value.bioShort}
          onChange={(v) => set('bioShort', v)}
        />
        <Row>
          <Text
            label="Based in"
            value={value.basedIn}
            onChange={(v) => set('basedIn', v)}
          />
          <Text
            label="Vocal range"
            value={value.vocalRange}
            onChange={(v) => set('vocalRange', v)}
          />
        </Row>
      </Group>

      <Group
        title="Biography"
        description="One entry per paragraph."
      >
        <StringList
          label="Paragraphs"
          items={value.bio}
          rows={5}
          addLabel="Add paragraph"
          onChange={(v) => set('bio', v)}
        />
      </Group>

      <Group title="Training">
        <StringList
          label="Lines"
          items={value.training}
          addLabel="Add line"
          onChange={(v) => set('training', v)}
        />
      </Group>

      <Group
        title="Portraits"
        description="Paths to the photographs. The first five run as the strip across the About page; the first is also the still the portrait column falls back to when the frame sequence cannot load."
      >
        <StringList
          label="Portrait paths"
          items={value.portraits}
          media="image"
          upload="portrait"
          addLabel="Add portrait"
          onChange={(v) => set('portraits', v)}
        />
      </Group>

      <Group
        title="Press"
        description="Short notices. These are separate from the testimonial cards on the About page — see the Testimonials tab — because a press list is three lines of type and a card has to hold a screen on its own."
      >
        <Repeater
          items={value.press}
          onChange={(v) => set('press', v)}
          blank={() => ({ quote: '', source: '' })}
          addLabel="Add notice"
          title={(item) => item.source || 'Untitled notice'}
          render={(item, setItem) => (
            <div className="space-y-4">
              <TextArea
                label="Quote"
                rows={3}
                value={item.quote}
                onChange={(v) => setItem({ ...item, quote: v })}
              />
              <Text
                label="Source"
                value={item.source}
                onChange={(v) => setItem({ ...item, source: v })}
              />
            </div>
          )}
        />
      </Group>

      <Group
        title="Statistics"
        description="A counted figure and the thing it counts."
      >
        <Repeater
          items={value.stats}
          onChange={(v) => set('stats', v)}
          blank={() => ({ value: '', label: '' })}
          addLabel="Add statistic"
          title={(item) => `${item.value} ${item.label}`.trim() || 'Untitled'}
          render={(item, setItem) => (
            <Row>
              <Text
                label="Value"
                value={item.value}
                onChange={(v) => setItem({ ...item, value: v })}
              />
              <Text
                label="Label"
                value={item.label}
                onChange={(v) => setItem({ ...item, label: v })}
              />
            </Row>
          )}
        />
      </Group>

      <Group
        title="Contact & links"
        description="Both addresses are written as mailto links. The three profiles open in a new tab."
      >
        <Row>
          <Text
            label="General email"
            value={value.contact.email}
            onChange={(v) =>
              set('contact', { ...value.contact, email: v })
            }
          />
          <Text
            label="Booking email"
            value={value.contact.booking}
            onChange={(v) =>
              set('contact', { ...value.contact, booking: v })
            }
          />
        </Row>
        <Row>
          <Text
            label="Instagram URL"
            mono
            value={value.contact.instagram}
            onChange={(v) =>
              set('contact', { ...value.contact, instagram: v })
            }
          />
          <Text
            label="YouTube URL"
            mono
            value={value.contact.youtube}
            onChange={(v) =>
              set('contact', { ...value.contact, youtube: v })
            }
          />
        </Row>
        <Text
          label="Spotify URL"
          mono
          value={value.contact.spotify}
          onChange={(v) => set('contact', { ...value.contact, spotify: v })}
        />
      </Group>
    </div>
  )
}
