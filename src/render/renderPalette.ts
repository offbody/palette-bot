import { mkdir } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"
import type { Palette } from "../types.js"

const CANVAS_WIDTH = 1440
const CANVAS_HEIGHT = 1153
const MIN_COLORS = 2
const MAX_COLORS = 7

export type RenderPaletteOptions = {
  outputPath: string
}

export async function renderPalette(
  palette: Palette,
  options: RenderPaletteOptions,
) {
  validatePalette(palette)

  await mkdir(path.dirname(options.outputPath), { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
    deviceScaleFactor: 1,
  })

  try {
    await page.setContent(createPaletteHtml(palette), {
      waitUntil: "networkidle",
    })
    await page.screenshot({
      path: options.outputPath,
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      },
    })
  } finally {
    await browser.close()
  }
}

function validatePalette(palette: Palette) {
  if (!palette.paletteName.trim()) {
    throw new Error("Palette name is required.")
  }

  if (
    palette.colors.length < MIN_COLORS ||
    palette.colors.length > MAX_COLORS
  ) {
    throw new Error(
      `Palette must contain between ${MIN_COLORS} and ${MAX_COLORS} colors.`,
    )
  }

  for (const color of palette.colors) {
    if (!color.name.trim()) {
      throw new Error("Every palette color must have a name.")
    }

    if (!/^#[0-9a-f]{6}$/i.test(color.hex)) {
      throw new Error(`Invalid hex color: ${color.hex}`)
    }
  }
}

function createPaletteHtml(palette: Palette) {
  const columns = palette.colors
    .map((color, index) => {
      const textColor = getReadableTextColor(color.hex)

      return `
        <section class="swatch" style="background: ${escapeHtml(color.hex)}; color: ${textColor};">
          <div class="swatchIndex">${String(index + 1).padStart(2, "0")}</div>
          <div class="swatchMeta">
            <div class="colorName">${escapeHtml(color.name)}</div>
            <div class="hex">${escapeHtml(color.hex.toUpperCase())}</div>
          </div>
        </section>
      `
    })
    .join("")

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            width: ${CANVAS_WIDTH}px;
            height: ${CANVAS_HEIGHT}px;
            margin: 0;
            background: #f2eee6;
            color: #171717;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          .canvas {
            width: ${CANVAS_WIDTH}px;
            height: ${CANVAS_HEIGHT}px;
            padding: 72px;
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 42px;
          }

          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 48px;
          }

          .eyebrow {
            margin-bottom: 18px;
            color: #5d5a53;
            font-size: 26px;
            line-height: 1;
            letter-spacing: 0;
          }

          h1 {
            max-width: 980px;
            margin: 0;
            font-size: 86px;
            line-height: 0.95;
            font-weight: 760;
            letter-spacing: 0;
          }

          .count {
            min-width: 140px;
            padding-top: 8px;
            text-align: right;
            color: #5d5a53;
            font-size: 28px;
            line-height: 1.1;
          }

          .palette {
            min-height: 0;
            display: grid;
            grid-template-columns: repeat(${palette.colors.length}, minmax(0, 1fr));
            overflow: hidden;
            border: 2px solid rgba(23, 23, 23, 0.16);
          }

          .swatch {
            min-width: 0;
            padding: 28px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border-right: 2px solid rgba(23, 23, 23, 0.16);
          }

          .swatch:last-child {
            border-right: 0;
          }

          .swatchIndex {
            font-size: 20px;
            line-height: 1;
            opacity: 0.72;
          }

          .swatchMeta {
            min-width: 0;
          }

          .colorName {
            margin-bottom: 12px;
            font-size: clamp(22px, ${palette.colors.length <= 4 ? "38px" : "30px"}, 42px);
            line-height: 1;
            font-weight: 700;
            overflow-wrap: anywhere;
          }

          .hex {
            font-size: 20px;
            line-height: 1;
            font-weight: 650;
            opacity: 0.78;
          }

          .footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #5d5a53;
            font-size: 24px;
            line-height: 1;
          }

          .rule {
            width: 420px;
            height: 2px;
            background: rgba(23, 23, 23, 0.18);
          }
        </style>
      </head>
      <body>
        <main class="canvas">
          <header class="header">
            <div>
              <div class="eyebrow">Palette Study</div>
              <h1>${escapeHtml(palette.paletteName)}</h1>
            </div>
            <div class="count">${palette.colors.length} colors</div>
          </header>

          <div class="palette">
            ${columns}
          </div>

          <footer class="footer">
            <div>1440 x 1153 px</div>
            <div class="rule"></div>
            <div>palette-bot</div>
          </footer>
        </main>
      </body>
    </html>
  `
}

function getReadableTextColor(hex: string) {
  const normalized = hex.slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

  return luminance > 0.62 ? "#171717" : "#fffaf0"
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
