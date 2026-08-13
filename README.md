# palette-bot

Palette image renderer for automated color palette publishing.

## Step 1: Palette Renderer

The renderer accepts a JSON palette with 2 to 5 colors and exports a PNG at exactly 1440 x 1153 px.

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

Render the fixture set for 2, 3, 4, and 5 colors:

```bash
pnpm run test:render
```

This writes PNG files to `output/fixtures/` and checks that every rendered image is exactly 1440 x 1153 px.

## Step 2: OKLCH Generator

Generate a deterministic palette JSON:

```bash
pnpm run generate -- --colors 5 --seed 2026-08-13 --output output/generated-palette.json
```

Choose a preset, harmony mode, and candidate batch size:

```bash
pnpm run generate -- --colors 5 --seed 2026-08-13 --preset brand-vivid --harmony triadic --candidates 32 --output output/generated-palette.json
```

Render the generated palette:

```bash
pnpm run render -- output/generated-palette.json output/generated-palette.png
```

Generate and render in one command:

```bash
pnpm run render:generated -- --colors 5 --seed 2026-08-13 --json output/generated-palette.json --png output/generated-palette.png
```

Available presets:

- `ui-soft`
- `editorial-bold`
- `minimal-neutral`
- `brand-vivid`
- `dark-interface`

Available harmony modes:

- `analogous`
- `complementary`
- `triadic`
- `monochrome`
- `warm`
- `cool`
- `muted`
- `vivid`

The generator creates a batch of candidates, scores them for contrast, separation, harmony, lightness, and usability, then keeps the strongest result.

## Step 2.1: Publication Strategy

Create a deterministic post plan and render the post preview:

```bash
pnpm run publish:preview -- --date 2026-08-13 --attempts 16 --min-score 70 --plan output/post-plan.json --json output/post-palette.json --png output/post-palette.png --message output/post-message.txt
```

The publication strategy picks the post inputs from a date-based seed:

- color count
- preset
- harmony mode compatible with the preset
- candidate batch size
- renderer theme, currently `figma` by default
- Telegram-ready message text with color names and hex codes

The selection is pseudo-random but repeatable. The same date or seed produces the same post plan, which keeps scheduled runs debuggable and reproducible. The preview command can test several strategy attempts and keeps the strongest plan above the minimum score.

Post message format:

```text
Linen #FDF0D8
Dust #A5D3FF
Coral #BFA431
Cedar #7A82D1
Sage #945427
```

## Step 3: Telegram Publisher

Local Telegram credentials are read from `.secrets/telegram.env`:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Check channel access without publishing:

```bash
pnpm run publish:telegram:dry-run -- --env .secrets/telegram.env --photo output/post-palette.png --message output/post-message.txt
```

Publish the generated post:

```bash
pnpm run publish:telegram -- --env .secrets/telegram.env --photo output/post-palette.png --message output/post-message.txt
```

For GitHub Actions, add these repository secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Manual GitHub Actions publishing:

1. Open the `Publish` workflow in GitHub Actions.
2. Click `Run workflow`.
3. Keep `dry_run` enabled for the first check.
4. Disable `dry_run` only when you want to publish to the Telegram channel.

Scheduled GitHub Actions publishing runs daily at 09:00 UTC. It applies a deterministic 0 to 70 minute delay before publishing, so posts land between 13:00 and 14:10 in the Europe/Samara timezone. Manual runs do not wait.

Scheduled runs use a date-based seed, so each calendar day is reproducible. Manual runs use a run-based seed, so repeated manual publishes on the same day produce different palettes.

You can still override any decision:

```bash
pnpm run publish:preview -- --date 2026-08-13 --colors 5 --preset brand-vivid --harmony triadic --candidates 32 --theme technical --min-score 70 --message output/post-message.txt
```

The default publication renderer theme is `figma`. Use the technical template when needed:

```bash
pnpm run publish:preview -- --date 2026-08-13 --theme technical --png output/post-palette.png --message output/post-message.txt
```

Check generator determinism and color validity:

```bash
pnpm run test:generator
pnpm run test:publication-strategy
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
  ],
  "metadata": {
    "seed": "2026-08-13",
    "generatedAt": "2026-08-13T00:00:00.000Z",
    "colorCount": 2,
    "preset": "ui-soft",
    "harmony": "analogous",
    "candidateCount": 24,
    "selectedCandidate": 7,
    "score": 84,
    "scoreBreakdown": {
      "contrast": 93,
      "separation": 82,
      "harmony": 79,
      "lightness": 88,
      "usability": 100
    }
  }
}
```
