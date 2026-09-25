import type { MusicalCover } from '@/types/content'
import {
  Color,
  Group,
  MediaField,
  Num,
  Repeater,
  Row,
  Text,
  TextArea,
  Toggle,
} from '@/components/admin/fields'

/**
 * The covers shelf, as a form.
 *
 * One card a song, and the form is in the order somebody would fill it in: what
 * it is, whose it is, then the files. The video field is the one that matters —
 * dropping a recording on it extracts the soundtrack, takes the sleeve's still
 * and measures the length, writing the three fields below it in one go. The same
 * field on the About page does the same thing; this is here for the times when
 * twelve of them are being added at once and a form is simply faster than a
 * page.
 *
 * `id` is not editable. It is what keeps exactly one card sounding while the
 * others hand the transport over, so it has to stay stable across a rename —
 * which is precisely what an editable id would not do.
 */
export function CoversSection({
  value,
  onChange,
}: {
  value: MusicalCover[]
  onChange: (next: MusicalCover[]) => void
}) {
  return (
    <div className="space-y-6">
      <Group
        title="Musical covers"
        description="Songs she did not write, sung anyway — the second key over the listening shelf on the About page. A cover that was part of a staged performance belongs in the archive instead; this is for the ones that stand on their own. The shelf's covers key stays hidden from visitors until there is at least one here."
      >
        <Repeater<MusicalCover>
          items={value}
          onChange={onChange}
          addLabel="Add a cover"
          title={(c, i) => c.title || `Cover ${i + 1}`}
          blank={() => ({
            // Time-based rather than counted: two rows added and one removed
            // must not be able to produce two cards with the same id.
            id: `cover-${Date.now().toString(36)}`,
            title: '',
            artist: '',
            cover: '',
            duration: 0,
          })}
          copy={(c) => ({
            ...structuredClone(c),
            id: `cover-${Date.now().toString(36)}`,
            title: `${c.title} (copy)`,
          })}
          render={(cover, set) => (
            <div className="space-y-5">
              <Row>
                <Text
                  label="Song"
                  value={cover.title}
                  onChange={(v) => set({ ...cover, title: v })}
                />
                <Text
                  label="Originally by"
                  hint="The writer, or the recording everybody knows it from."
                  value={cover.artist}
                  onChange={(v) => set({ ...cover, artist: v })}
                />
              </Row>

              <TextArea
                label="Liner note"
                rows={2}
                hint="One line under the title: the arrangement, the room, the occasion."
                value={cover.note ?? ''}
                onChange={(v) => set({ ...cover, note: v })}
              />

              <MediaField
                label="Video"
                kind="video"
                hint="Drop a recording here and the audio, the sleeve still and the length are taken from it. Optional — a cover can be audio alone."
                value={cover.videoSrc ?? ''}
                onChange={(v) => set({ ...cover, videoSrc: v })}
                upload={{
                  kind: 'video',
                  deriveKinds: ['audio', 'poster'],
                  clearable: true,
                  // The dialog hands back every key it made; this is where they
                  // stop being a list of files and become one card.
                  onResult: (result) =>
                    set({
                      ...cover,
                      videoSrc: result.key,
                      audioSrc: result.audio ?? cover.audioSrc,
                      cover: result.poster ?? cover.cover,
                      duration: result.duration ?? cover.duration,
                    }),
                }}
              />

              <Row>
                <MediaField
                  label="Audio"
                  kind="audio"
                  hint="Normally filled in by the video above. What the card plays."
                  value={cover.audioSrc ?? ''}
                  onChange={(v) => set({ ...cover, audioSrc: v })}
                  upload={{ kind: 'audio', clearable: true }}
                />
                <MediaField
                  label="Sleeve"
                  kind="image"
                  hint="4:5, like the discipline covers. A 16:9 still will be centre-cropped."
                  value={cover.cover}
                  onChange={(v) => set({ ...cover, cover: v })}
                  upload={{ kind: 'cover', clearable: true }}
                />
              </Row>

              <Row>
                <Num
                  label="Length, in seconds"
                  hint="Drives the scrubber before a file is attached."
                  value={cover.duration}
                  onChange={(v) => set({ ...cover, duration: v })}
                />
                <Num
                  label="Year"
                  value={cover.year ?? new Date().getFullYear()}
                  onChange={(v) => set({ ...cover, year: v })}
                />
              </Row>

              <Row>
                <Color
                  label="Rim accent"
                  hint="Left blank, the card uses the shelf's brass."
                  value={cover.accent ?? ''}
                  onChange={(v) => set({ ...cover, accent: v })}
                />
                <Toggle
                  label="Pull to the front"
                  hint="Featured covers are shown first."
                  value={Boolean(cover.featured)}
                  onChange={(v) => set({ ...cover, featured: v })}
                />
              </Row>

              <p className="font-mono text-[0.68rem] text-neutral-600">
                id: {cover.id}
              </p>
            </div>
          )}
        />
      </Group>
    </div>
  )
}
