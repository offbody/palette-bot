# palette-bot

Palette image renderer for automated color palette publishing.

## Step 1: Palette Renderer

The renderer accepts a JSON palette with 2 to 7 colors and exports a PNG at exactly 1440 x 1153 px.

```bash
pnpm install
pnpm run playwright:install
pnpm run render
```

By default, `pnpm run render` reads `data/sample-palette.json` and writes `output/palette-sample.png`.

You can pass custom paths:

```bash
pnpm run render -- data/my-palette.json output/my-palette.png
```

Render the fixture set for 2, 3, 5, and 7 colors:

```bash
pnpm run test:render
```

This writes PNG files to `output/fixtures/` and checks that every rendered image is exactly 1440 x 1153 px.

## Step 2: OKLCH Generator

Generate a deterministic palette JSON:

```bash
pnpm run generate -- --colors 5 --seed 2026-08-13 --output output/generated-palette.json
```

Render the generated palette:

```bash
pnpm run render -- output/generated-palette.json output/generated-palette.png
```

Generate and render in one command:

```bash
pnpm run render:generated -- --colors 7 --seed 2026-08-13 --json output/generated-palette.json --png output/generated-palette.png
```

The default renderer theme is `technical`. Use the Figma-matched template when needed:

```bash
pnpm run render -- output/generated-palette.json output/generated-palette.png --theme figma
pnpm run render:generated -- --colors 3 --seed 2026-08-13 --theme figma --json output/generated-palette.json --png output/generated-palette.png
```

Check generator determinism and color validity:

```bash
pnpm run test:generator
```

Palette JSON format:

```json
{
  "paletteName": "Mineral Bloom",
  "colors": [
    {
      "name": "Chalk",
      "hex": "#F5F1E8"
    },
    {
      "name": "Ink",
      "hex": "#202329"
    }
  ]
}
```
