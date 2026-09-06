/**
 * The scattered points the About page sits on.
 *
 * Fixed to the viewport rather than to the document, which is the whole
 * character of the thing. A field that scrolls with the page reads as
 * wallpaper a few inches behind the text; one that holds still while three
 * thousand pixels of page slide across it reads as depth — the points are
 * far enough away to have no parallax, the way real ones do not. It is also
 * how the reference does it: the same points sit at the same screen
 * coordinates a screenful apart.
 *
 * Two tiles, not one, and both larger than the window they land in. A single
 * tile small enough to see repeat two or three times across a wide screen
 * gets found in about a second, and once it is found the field is a texture
 * rather than a sky. At 1400 and 900 neither quite repeats on a laptop, and
 * where they do on a bigger screen they disagree, because they share no
 * factor. Each tile's own points are spaced by rejection sampling measured
 * around the wrap, so neither has a seam or a clump of its own.
 *
 * Density is about twenty points a megapixel, which is roughly thirty in a
 * 1440×900 window and is a lot sparser than the first pass. Scattered points
 * stop reading as distance somewhere around double that and start reading as
 * noise over the page, and the correction is always downward: the field is
 * meant to be noticed second.
 *
 * No animation. Points that twinkle or drift turn a background into
 * something the reader has to decide to ignore, and the page already has one
 * moving thing in it.
 */

const FAR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1400' height='1400'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='1244' cy='632' r='1.1' opacity='0.42'/%3E%3Ccircle cx='866' cy='108' r='1.2' opacity='0.51'/%3E%3Ccircle cx='1110' cy='1359' r='1.6' opacity='0.55'/%3E%3Ccircle cx='764' cy='456' r='1.3' opacity='0.53'/%3E%3Ccircle cx='17' cy='208' r='1.0' opacity='0.53'/%3E%3Ccircle cx='466' cy='333' r='1.9' opacity='0.28'/%3E%3Ccircle cx='953' cy='840' r='2.1' opacity='0.26'/%3E%3Ccircle cx='965' cy='1205' r='1.8' opacity='0.34'/%3E%3Ccircle cx='1371' cy='1301' r='1.5' opacity='0.63'/%3E%3Ccircle cx='561' cy='1272' r='1.6' opacity='0.68'/%3E%3Ccircle cx='755' cy='1275' r='1.6' opacity='0.58'/%3E%3Ccircle cx='610' cy='928' r='1.5' opacity='0.5'/%3E%3Ccircle cx='254' cy='1183' r='2.0' opacity='0.48'/%3E%3Ccircle cx='397' cy='589' r='1.6' opacity='0.55'/%3E%3Ccircle cx='1311' cy='819' r='1.5' opacity='0.57'/%3E%3Ccircle cx='234' cy='185' r='2.1' opacity='0.55'/%3E%3Ccircle cx='145' cy='536' r='1.4' opacity='0.31'/%3E%3Ccircle cx='998' cy='247' r='1.5' opacity='0.4'/%3E%3Ccircle cx='444' cy='1037' r='2.1' opacity='0.51'/%3E%3Ccircle cx='242' cy='855' r='1.3' opacity='0.66'/%3E%3Ccircle cx='715' cy='239' r='1.3' opacity='0.37'/%3E%3Ccircle cx='839' cy='656' r='1.1' opacity='0.3'/%3E%3Ccircle cx='491' cy='111' r='1.9' opacity='0.35'/%3E%3Ccircle cx='628' cy='594' r='1.5' opacity='0.6'/%3E%3C/g%3E%3C/svg%3E\")"

const NEAR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='900'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='281' cy='861' r='1.7' opacity='0.64'/%3E%3Ccircle cx='531' cy='890' r='1.6' opacity='0.54'/%3E%3Ccircle cx='298' cy='317' r='1.9' opacity='0.62'/%3E%3Ccircle cx='51' cy='737' r='1.6' opacity='0.36'/%3E%3Ccircle cx='61' cy='368' r='1.2' opacity='0.33'/%3E%3Ccircle cx='742' cy='579' r='2.1' opacity='0.64'/%3E%3Ccircle cx='640' cy='325' r='1.6' opacity='0.33'/%3E%3C/g%3E%3C/svg%3E\")"

export function Starfield() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-75"
      style={{
        backgroundImage: `${FAR}, ${NEAR}`,
        backgroundSize: '1400px 1400px, 900px 900px',
        // The second tile is pushed off the first's origin so the two do not
        // both start their pattern in the top-left corner, which is the one
        // place a viewer would otherwise see them agree.
        backgroundPosition: '0 0, 313px 487px',
      }}
    />
  )
}
