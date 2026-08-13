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
