# Pipeline status

Snapshot of what has and hasn't been produced. Update as parts land.

## Chosen character reference

Variation **A**, FLUX.1-Krea-dev, seed `1011`, 768×1152, 28 steps.
Prompt is in `PROMPTS.md`. Seed is fixed, so the reference is reproducible.

## Reference images

The repo is public, so Hugging Face Spaces can fetch the guitar shots directly
from raw.githubusercontent.com — no upload step needed:

| Shot | URL |
|---|---|
| front (primary TRELLIS input) | `https://raw.githubusercontent.com/ascendnowpc/sanjana-portfolio/main/public/i1.png` |
| others | same path, `i2.png` … `i6.png` |

## Parts

| Part | Model | State |
|---|---|---|
| girl | `dev-bjoern/sam3d-body-mcp` | **built** — see URL below |
| mic | `trellis-community/TRELLIS` | blocked: Space down |
| guitar | `trellis-community/TRELLIS` | blocked: Space down + no reference image supplied |

### girl.glb

Reconstructed from variation A. Download and save as `scene/assets/girl.glb`:

```
https://dev-bjoern-sam3d-body-mcp.hf.space/--replicas/65dn7/gradio_api/file=/tmp/gradio/cdd94f2975f0d1a37360fedac7d7b616a8338f1131b8dbd5d4fa5e5acd2250a6/body_92586aae.glb
```

**This URL has since expired** — Gradio serves these from `/tmp` and the link
dies when the Space restarts. The reference is reproducible from the fixed
seed, so the mesh can be rebuilt: regenerate the image, re-run the
reconstruction.

Next time, persist outputs to a Hugging Face repo immediately after generating
them. A repo URL is permanent; a `/tmp` URL is not.

## Known limitations

- **These are static meshes.** Posing her seated, or animating her, requires
  rigging in Mixamo or Blender. That is outside this pipeline.
- **SAM3D-body fits a parametric body model** rather than sculpting from the
  photo. It captures pose, height and build; it does *not* carry over the
  reference face, and hands come out as generic model hands.
- Poly counts and file sizes are unmeasured — this session's egress policy
  blocks every Hugging Face host, so the GLB could not be opened here. The
  viewer prints live triangle counts in its HUD once the file is in place.

## Blockers

1. `trellis-community/TRELLIS` returns `Not Found` on every endpoint
   (`start_session`, `preprocess_image`, `generate_and_extract_glb`).
   Duplicating the Space to a personal account is the reliable workaround.
2. `not-lain/background-removal` is down the same way. Not on the critical
   path — TRELLIS does its own background removal in `preprocess_image`.
3. ZeroGPU quota exhausted on the free tier. Resets daily; PRO raises it.
4. ~~No reference image supplied for the polka-dot guitar.~~ Resolved — the
   shots are in `public/i1.png` … `i6.png` and are publicly fetchable.
