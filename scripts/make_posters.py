#!/usr/bin/env python3
"""
Generates the placeholder stage-still artwork used by the site before real
footage is wired in. Everything is deterministic (seeded per-slug), so the
same slug always produces the same frame and git diffs stay quiet.

Run scripts/rasterize.mjs afterwards: the wall rescales tiles every frame and
an <img> pointing at an SVG re-rasterises on every scale change.

Delete public/media/posters + both scripts once real stills exist.
"""
import math, os, random

OUT_POSTER = "public/media/posters"
OUT_PORTRAIT = "public/media/portraits"

# Billie-adjacent palette: midnight bases, ice-cyan / electric-blue / violet washes.
PALETTES = {
    "ice":     ("#03070f", "#0a2b3d", "#4fd8e8", "#9df3ff"),
    "electric":("#03060f", "#0b1c46", "#3f7dfb", "#a8c6ff"),
    "violet":  ("#06040f", "#241046", "#8b5cf6", "#d9c2ff"),
    "teal":    ("#02090c", "#06333a", "#2fd6b8", "#a5f5e4"),
    "ember":   ("#0b0603", "#3b1c07", "#f0a23c", "#ffd9a0"),
    "rose":    ("#0b0308", "#3d0b26", "#f0568f", "#ffc0d6"),
    "steel":   ("#040609", "#16222e", "#7f9dbb", "#cfe0f0"),
}


def beams(rnd, w, h, accent, n):
    out = []
    for i in range(n):
        ox = rnd.uniform(0.15, 0.85) * w
        spread = rnd.uniform(0.10, 0.30) * w
        drift = rnd.uniform(-0.25, 0.25) * w
        bx = ox + drift
        op = rnd.uniform(0.10, 0.26)
        # No blur filter here: 30+ of these composite every frame in the 3D
        # wall, and a soft-edged gradient reads the same for a fraction of the
        # rasterisation cost.
        out.append(
            f'<polygon points="{ox:.0f},-40 {bx-spread*1.35:.0f},{h} {bx+spread*1.35:.0f},{h}" '
            f'fill="url(#beam{i})" opacity="{op:.2f}"/>'
        )
    defs = "".join(
        f'<linearGradient id="beam{i}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0%" stop-color="{accent}" stop-opacity="0.75"/>'
        f'<stop offset="45%" stop-color="{accent}" stop-opacity="0.26"/>'
        f'<stop offset="100%" stop-color="{accent}" stop-opacity="0"/>'
        f"</linearGradient>"
        for i in range(n)
    )
    return defs, "".join(out)


def bokeh(rnd, w, h, accent, hi, n):
    """Out-of-focus highlights, drawn with radial gradients rather than blur."""
    out = [
        f'<radialGradient id="dotA"><stop offset="0%" stop-color="{accent}" stop-opacity="0.9"/>'
        f'<stop offset="100%" stop-color="{accent}" stop-opacity="0"/></radialGradient>',
        f'<radialGradient id="dotB"><stop offset="0%" stop-color="{hi}" stop-opacity="0.9"/>'
        f'<stop offset="100%" stop-color="{hi}" stop-opacity="0"/></radialGradient>',
    ]
    defs = "<defs>" + "".join(out) + "</defs>"
    dots = []
    for _ in range(n):
        cx, cy = rnd.uniform(0, w), rnd.uniform(0, h * 0.85)
        r = rnd.uniform(8, 46)
        ref = "dotB" if rnd.random() > 0.65 else "dotA"
        dots.append(
            f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.1f}" fill="url(#{ref})" '
            f'opacity="{rnd.uniform(0.10, 0.5):.2f}"/>'
        )
    return defs + "".join(dots)


def figure(rnd, w, h, pose):
    """Performer silhouette. Anchored to the lower third like a real stage frame."""
    cx = w * rnd.uniform(0.38, 0.62)
    base = h * 1.02
    scale = h / 900.0 * rnd.uniform(0.85, 1.15)
    hh = 46 * scale                       # head radius
    hy = base - 470 * scale               # head centre y
    sw = 118 * scale                      # shoulder half-width

    body = (
        f"M{cx - sw:.0f},{base:.0f} "
        f"C{cx - sw * 1.05:.0f},{hy + 190 * scale:.0f} {cx - sw * 0.92:.0f},{hy + 105 * scale:.0f} "
        f"{cx - sw * 0.55:.0f},{hy + 74 * scale:.0f} "
        f"L{cx + sw * 0.55:.0f},{hy + 74 * scale:.0f} "
        f"C{cx + sw * 0.92:.0f},{hy + 105 * scale:.0f} {cx + sw * 1.05:.0f},{hy + 190 * scale:.0f} "
        f"{cx + sw:.0f},{base:.0f} Z"
    )
    head = f'<circle cx="{cx:.0f}" cy="{hy:.0f}" r="{hh:.0f}"/>'
    hair = (
        f'<path d="M{cx - hh * 1.25:.0f},{hy + 10 * scale:.0f} '
        f"C{cx - hh * 1.35:.0f},{hy - hh * 1.5:.0f} {cx + hh * 1.35:.0f},{hy - hh * 1.5:.0f} "
        f"{cx + hh * 1.25:.0f},{hy + 10 * scale:.0f} "
        f"C{cx + hh * 1.4:.0f},{hy + 120 * scale:.0f} {cx + hh * 0.7:.0f},{hy + 150 * scale:.0f} "
        f"{cx + hh * 0.55:.0f},{hy + 96 * scale:.0f} "
        f"L{cx - hh * 0.55:.0f},{hy + 96 * scale:.0f} "
        f"C{cx - hh * 0.7:.0f},{hy + 150 * scale:.0f} {cx - hh * 1.4:.0f},{hy + 120 * scale:.0f} "
        f'{cx - hh * 1.25:.0f},{hy + 10 * scale:.0f} Z"/>'
    )

    arms = ""
    if pose == "raised":   # mic hand lifted overhead
        ax, ay = cx + sw * 0.75, hy - 150 * scale
        arms = (
            f'<path d="M{cx + sw * 0.45:.0f},{hy + 120 * scale:.0f} '
            f"Q{cx + sw * 1.3:.0f},{hy + 30 * scale:.0f} {ax:.0f},{ay:.0f} "
            f"L{ax + 26 * scale:.0f},{ay + 16 * scale:.0f} "
            f'Q{cx + sw * 1.5:.0f},{hy + 70 * scale:.0f} {cx + sw * 0.5:.0f},{hy + 175 * scale:.0f} Z"/>'
            f'<rect x="{ax - 9 * scale:.0f}" y="{ay - 58 * scale:.0f}" width="{19 * scale:.0f}" '
            f'height="{62 * scale:.0f}" rx="{9 * scale:.0f}"/>'
        )
    elif pose == "mic":    # hand to mouth on a handheld
        mx, my = cx + hh * 0.95, hy + 22 * scale
        arms = (
            f'<path d="M{cx + sw * 0.5:.0f},{hy + 190 * scale:.0f} '
            f"Q{cx + sw * 1.25:.0f},{hy + 120 * scale:.0f} {mx:.0f},{my + 34 * scale:.0f} "
            f"L{mx + 30 * scale:.0f},{my + 60 * scale:.0f} "
            f'Q{cx + sw * 1.45:.0f},{hy + 165 * scale:.0f} {cx + sw * 0.62:.0f},{hy + 240 * scale:.0f} Z"/>'
            f'<rect x="{mx - 8 * scale:.0f}" y="{my - 26 * scale:.0f}" width="{17 * scale:.0f}" '
            f'height="{66 * scale:.0f}" rx="{8 * scale:.0f}" transform="rotate(24 {mx:.0f} {my:.0f})"/>'
        )
    else:                  # stand: vertical mic stand in front
        sx = cx - sw * 0.95
        arms = (
            f'<rect x="{sx:.0f}" y="{hy + 26 * scale:.0f}" width="{5 * scale:.0f}" '
            f'height="{380 * scale:.0f}" rx="{2 * scale:.0f}"/>'
            f'<rect x="{sx - 7 * scale:.0f}" y="{hy + 4 * scale:.0f}" width="{19 * scale:.0f}" '
            f'height="{54 * scale:.0f}" rx="{9 * scale:.0f}" transform="rotate(28 {sx:.0f} {hy:.0f})"/>'
        )

    return f'<g fill="#000">{hair}{head}<path d="{body}"/>{arms}</g>'


def frame(slug, w=1600, h=900, palette=None, pose=None, seed_extra=0):
    rnd = random.Random(hash((slug, seed_extra)) & 0xFFFFFFFF)
    key = palette or rnd.choice(list(PALETTES))
    base, mid, accent, hi = PALETTES[key]
    pose = pose or rnd.choice(["raised", "mic", "stand"])
    wash_x, wash_y = rnd.uniform(0.3, 0.7), rnd.uniform(0.25, 0.55)

    beam_defs, beam_svg = beams(rnd, w, h, hi, rnd.randint(2, 4))

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
<defs>
<radialGradient id="wash" cx="{wash_x:.2f}" cy="{wash_y:.2f}" r="0.85">
<stop offset="0%" stop-color="{accent}" stop-opacity="0.55"/>
<stop offset="45%" stop-color="{mid}" stop-opacity="0.65"/>
<stop offset="100%" stop-color="{base}" stop-opacity="1"/>
</radialGradient>
<radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
<stop offset="45%" stop-color="#000" stop-opacity="0"/>
<stop offset="100%" stop-color="#000" stop-opacity="0.85"/>
</radialGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="{accent}" stop-opacity="0"/>
<stop offset="100%" stop-color="{accent}" stop-opacity="0.30"/>
</linearGradient>
<radialGradient id="haze">
<stop offset="0%" stop-color="{hi}" stop-opacity="0.85"/>
<stop offset="100%" stop-color="{hi}" stop-opacity="0"/>
</radialGradient>
<!-- The only remaining filter: one blur pass for the performer's rim light. -->
<filter id="rim" x="-30%" y="-30%" width="160%" height="160%">
<feGaussianBlur stdDeviation="{w * 0.007:.0f}"/>
</filter>
{beam_defs}
</defs>
<rect width="{w}" height="{h}" fill="{base}"/>
<rect width="{w}" height="{h}" fill="url(#wash)"/>
<ellipse cx="{w * wash_x:.0f}" cy="{h * 0.95:.0f}" rx="{w * 0.62:.0f}" ry="{h * 0.24:.0f}"
  fill="url(#haze)" opacity="0.22"/>
{beam_svg}
{bokeh(rnd, w, h, accent, hi, rnd.randint(14, 30))}
<g opacity="0.9" filter="url(#rim)">{figure(rnd, w, h, pose).replace('fill="#000"', f'fill="{hi}"')}</g>
{figure(rnd, w, h, pose)}
<rect y="{h * 0.72:.0f}" width="{w}" height="{h * 0.28:.0f}" fill="url(#floor)" opacity="0.5"/>
<rect width="{w}" height="{h}" fill="url(#vig)"/>
</svg>'''


POSTERS = [
    ("midnight-bloom-live", "ice", "raised"),
    ("glass-house-sessions", "electric", "mic"),
    ("wildflower-tour-night-3", "teal", "raised"),
    ("cabaret-the-blue-room", "violet", "stand"),
    ("hadestown-persephone", "ember", "mic"),
    ("acoustic-rooftop-set", "steel", "stand"),
    ("into-the-woods-baker", "teal", "raised"),
    ("neon-hymns-studio", "violet", "mic"),
    ("chicago-roxie-hart", "rose", "raised"),
    ("unplugged-at-the-chapel", "ice", "stand"),
    ("orchestral-night-symphony-hall", "electric", "raised"),
    ("les-mis-eponine", "ember", "mic"),
    ("late-night-demo-tapes", "steel", "mic"),
    ("solstice-open-air", "teal", "raised"),
    ("velvet-room-jazz-standards", "rose", "stand"),
    ("first-light-single", "ice", "mic"),
]

os.makedirs(OUT_POSTER, exist_ok=True)
os.makedirs(OUT_PORTRAIT, exist_ok=True)

for slug, pal, pose in POSTERS:
    with open(f"{OUT_POSTER}/{slug}.svg", "w") as f:
        f.write(frame(slug, 1600, 900, pal, pose))

# Editorial portraits for the About strip — 4:5, tighter crop, single wash.
for i, pal in enumerate(["ice", "rose", "violet", "steel", "ember", "electric"]):
    with open(f"{OUT_PORTRAIT}/portrait-{i + 1}.svg", "w") as f:
        f.write(frame(f"portrait-{i}", 900, 1125, pal, "mic", seed_extra=7))

print(f"posters: {len(POSTERS)}  portraits: 6")
