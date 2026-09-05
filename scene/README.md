# 3D Singer Scene — assembly viewer

Composes three **separate** GLB meshes into one lit, rotating stage scene.

## Expected assets

Drop these into `scene/assets/`:

| File | Source pipeline |
|---|---|
| `guitar.glb` | product photo → TRELLIS |
| `mic.glb`    | FLUX/Qwen reference → background removal → TRELLIS |
| `girl.glb`   | A-pose reference → background removal → SAM3D-body (TRELLIS fallback) |

Any missing file is replaced by a labelled wireframe proxy so the layout,
lighting and framing stay verifiable before the meshes exist.

## Run

```bash
npx vite --open scene/          # or: python3 -m http.server, then open /scene/
```

## Controls

- Drag to orbit, scroll to zoom.
- `Space` toggles the turntable.
- `P` toggles proxy visibility.
- Placement constants live in `PLACEMENT` at the top of `main.js` — expect to
  tune them once the real meshes land, since every image-to-3D model returns its
  own scale and origin.

## Note on rigging

These are **static meshes**. Posing (e.g. seated) or animation requires rigging
in Mixamo or Blender — that is outside this pipeline.
