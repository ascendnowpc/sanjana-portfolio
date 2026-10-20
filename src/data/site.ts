import type { PortraitCopy, SiteProfile } from '@/types/content'

/** PLACEHOLDER COPY — swap for Sanjana's real bio, links and portraits. */
export const PROFILE: SiteProfile = {
  name: 'SANJANA',
  role: 'Vocalist',
  tagline: 'Solo concerts, musical theatre, Hindi singing and honor choir.',
  bioShort:
    'A performer who works in rooms rather than genres — arena, black box, chapel, garage.',
  bio: [
    'Sanjana is a vocalist and performer working across solo concert repertoire, musical theatre and original studio writing. Her work tends to be defined less by genre than by the room it happens in: a four-thousand-seat arena and a ninety-seat black box ask for completely different instruments, and she treats them that way.',
    'Trained classically before moving into theatre, she was cast as Éponine out of an open call three weeks before opening — a run that led to Sally Bowles, Roxie Hart and Persephone across the following four seasons. Alongside the stage work she writes and records her own material, most of it tracked live with no comping.',
    'Recent work includes the Midnight Bloom arena run, a one-night orchestral commission rescoring six original songs for fifty-two players, and the debut EP Neon Hymns — cut over eleven nights with every vocal kept as a single continuous take.',
  ],
  basedIn: 'Antwerp, Belgium',
  vocalRange: 'Mezzo-soprano · F3 – E6',
  training: [
    'Hindustani classical — 9 years',
    'Musical theatre performance, Royal Conservatory',
    'Estill Voice Training, Level 2',
    'Sight-singing & ensemble, City Symphony Chorus',
  ],
  portraits: [
    '/media/portraits/portrait-1.jpg',
    '/media/portraits/portrait-2.jpg',
    '/media/portraits/portrait-3.jpg',
    '/media/portraits/portrait-4.jpg',
    '/media/portraits/portrait-5.jpg',
    '/media/portraits/portrait-6.jpg',
  ],
  press: [
    {
      quote:
        'She sings the way a room sounds after everyone has stopped talking — you lean in without deciding to.',
      source: 'The Evening Review',
    },
    {
      quote:
        'The most disciplined Sally Bowles this city has seen in a decade, and by some distance the saddest.',
      source: 'Stage & Signal',
    },
    {
      quote: 'Neon Hymns is a debut with nothing hidden behind the mix. Rare, and slightly terrifying.',
      source: 'Long Player Quarterly',
    },
  ],
  stats: [
    { value: '40+', label: 'Solo concerts' },
    { value: '11', label: 'Theatre productions' },
    { value: '4', label: 'Records & EPs' },
    { value: '9k', label: 'Largest room' },
  ],
  contact: {
    email: 'sanjana.j30nov@gmail.com',
    // Blank on purpose: there are no profiles yet, and a blank address hides
    // its link — and the "Elsewhere" heading over it — wherever it would show.
    instagram: '',
    youtube: '',
    spotify: '',
  },
}

/**
 * The bio, as it is read down the left of the About page's portrait section.
 *
 * PLACEHOLDER COPY — swap for Sanjana's real bio. Written to the same brief as
 * `PROFILE.bio` above and against the same invented credits, so the two agree
 * with each other; neither is a source of fact. Every name, count and date
 * below is made up, which matters more here than anywhere else on the site,
 * because this is the part a reader will take as biography.
 *
 * Written as a life rather than as a pitch. It runs training, then the break,
 * then the record, then the range — which is the order the facts happened in
 * and, not by coincidence, the order that makes each beat explain the next.
 * The alternative is the shape most performer bios take, where four
 * paragraphs each claim the same thing in different adjectives.
 *
 * Headed beats rather than continuous prose, because the column is read at
 * scroll speed against something moving beside it. A reader who looks up at
 * the model and back down needs a line to land on, and a paragraph does not
 * give them one. The heads carry a fact apiece for the same reason — a
 * scanner who reads nothing else still comes away with four of them.
 *
 * `PortraitBeat` itself now lives in types/content.ts with the rest of the
 * editable model — the panel writes these, so its shape belongs beside every
 * other shape the panel writes. `accent` is the beat's final word, reversed
 * out by the page: split in the copy rather than found by a regex over the
 * string, so the emphasis falls on the word carrying the fact — `grade`,
 * `Belle`, `songs` — and never on a preposition that happened to end the line.
 *
 * Inside the lead and the bodies, `*a phrase*` is set in brass as the prose is
 * read in (see ScrollWords). Two or three a paragraph at most, on the words a
 * skimmer should leave with; brass on every other phrase is no emphasis at all.
 */
export const PORTRAIT: PortraitCopy = {
  lead: 'Singing has been the *one constant* in my life, woven into practically everything I do. My work spans solo concert repertoire, musical theatre, Western classical, Hindi classical, and honor choir. Being on stage lets me be *completely consumed* by it, nothing else on my mind.',

  beats: [
    {
      heading: 'A discipline I met in eighth',
      accent: 'grade',
      body: "In eighth grade, I began studying Hindustani classical, an entirely different vocal discipline from the one I'd trained in, and it *connected me to my culture* in a way nothing else had. It was also among the most demanding periods of my singing life, and I fell in love with it regardless. Raagas are where I feel *most at home* as a vocalist. I'd grown up surrounded by that music, so learning to sing it myself felt natural, almost inevitable.",
    },
    {
      heading: 'The first time I was cast as',
      accent: 'Belle',
      body: 'In seventh grade, I fell headlong into musical theater: I was cast as Belle in Beauty and the Beast, my first substantial production, and it *changed everything* for me. It was the first time I understood performing as something beyond vocal technique alone, something I could pour *my whole self* into. Acting and dancing in tandem with singing is what made me fall *irreversibly in love* with the stage.',
    },
    {
      heading: 'A voice that serves something',
      accent: 'larger',
      body: "In tenth and eleventh grade, I sang in honor choir, which taught me something solo performance never had: how to blend, how to let my voice *serve something larger* than itself rather than stand at its center. There's a distinct kind of connection that emerges when a group of people are working toward a *single, unified sound*. It deepened my appreciation for music considerably, and it fostered friendships that, I suspect, could only have formed that way.",
    },
    {
      heading: 'Ninety minutes, eleven',
      accent: 'songs',
      body: "In tenth grade, I was cast as Missy in The Marvelous Wonderettes, my first time carrying a role of this weight: ninety uninterrupted minutes on stage, eleven songs, three of them solos. It proved to be one of the most liberating experiences of my life, despite embodying someone else's character entirely. I *loved every second* of it, being on stage, singing, doing what I love.",
    },
  ],
}
