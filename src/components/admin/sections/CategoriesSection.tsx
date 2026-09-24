import type { Category, CategoryId, MusicCopy } from '@/types/content'
import {
  Color,
  Group,
  MediaField,
  Num,
  Repeater,
  Row,
  Select,
  Text,
  TextArea,
} from '@/components/admin/fields'

/**
 * The six disciplines, their cover art, and the recording the index opens on.
 *
 * A category is more load-bearing than it looks: its `id` is what every
 * performance files itself under, what the archive's filter puts in the query
 * string, and what the music shelf groups by. Renaming the *label* is free;
 * changing the `id` orphans every piece that pointed at it, which is why the
 * field below says so rather than quietly allowing it.
 */
export function CategoriesSection({
  categories,
  onCategoriesChange,
  music,
  onMusicChange,
  houseSlugs,
}: {
  categories: Category[]
  onCategoriesChange: (next: Category[]) => void
  music: MusicCopy
  onMusicChange: (next: MusicCopy) => void
  /** Every slug in the archive, for the house-clip picker. */
  houseSlugs: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-6">
      <Group
        title="Disciplines"
        description="The filter keys on the archive, the bands the grid is cut into, and one listening card each on the About page."
      >
        <Repeater
          items={categories}
          onChange={onCategoriesChange}
          blank={(): Category => ({
            id: '' as CategoryId,
            label: '',
            blurb: '',
            accent: '#cfcfcf',
          })}
          addLabel="Add discipline"
          title={(item) => item.label || item.id || 'Untitled'}
          render={(item, setItem) => (
            <div className="space-y-4">
              <Row>
                <Text
                  label="ID"
                  mono
                  value={item.id}
                  onChange={(v) => setItem({ ...item, id: v as CategoryId })}
                  hint="Used in links and to file performances. Changing it orphans every piece already filed under the old value — change those to match."
                />
                <Text
                  label="Label"
                  value={item.label}
                  onChange={(v) => setItem({ ...item, label: v })}
                />
              </Row>
              <Row>
                <Text
                  label="Short label"
                  value={item.short ?? ''}
                  onChange={(v) => setItem({ ...item, short: v || undefined })}
                  hint="Optional. Only for a name too long to sit in a filter chip."
                />
                <Color
                  label="Accent"
                  value={item.accent}
                  onChange={(v) => setItem({ ...item, accent: v })}
                  hint="Glows and rules while this discipline is the live one."
                />
              </Row>
              <TextArea
                label="Blurb"
                rows={2}
                value={item.blurb}
                onChange={(v) => setItem({ ...item, blurb: v })}
              />
              <MediaField
                label="Cover art"
                value={music.covers[item.id] ?? ''}
                onChange={(v) =>
                  onMusicChange({
                    ...music,
                    covers: { ...music.covers, [item.id]: v },
                  })
                }
                upload={{ kind: 'cover', clearable: true }}
                hint="The sleeve on the About page’s listening shelf. Cut it to 4:5 — a 16:9 frame centre-cropped into that loses a good deal of both sides. Left empty, the card falls back to the poster of the most recent piece."
              />
            </div>
          )}
        />
      </Group>

      <Group
        title="The index’s own sound"
        description="What plays under the front page once a visitor answers the sound question. Named by performance rather than by file, so it stays pinned to something real in the archive."
      >
        <Select
          label="Recording"
          value={music.houseClip.slug}
          options={houseSlugs}
          onChange={(v) =>
            onMusicChange({
              ...music,
              houseClip: { ...music.houseClip, slug: v },
            })
          }
        />
        <Row>
          <Num
            label="Start (seconds)"
            value={music.houseClip.from}
            onChange={(v) =>
              onMusicChange({
                ...music,
                houseClip: { ...music.houseClip, from: v },
              })
            }
          />
          <Num
            label="End (seconds)"
            value={music.houseClip.to ?? 0}
            onChange={(v) =>
              onMusicChange({
                ...music,
                houseClip: { ...music.houseClip, to: v > 0 ? v : null },
              })
            }
            hint="0 plays to the end of the file."
          />
        </Row>
      </Group>
    </div>
  )
}
