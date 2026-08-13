import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"
import type { Palette } from "../types.js"

const CANVAS_WIDTH = 1440
const CANVAS_HEIGHT = 1153
const MIN_COLORS = 2
const MAX_COLORS = 7
const PALETTE_WIDTH = 1008
const PALETTE_GAP = 24

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
    await page.setContent(await createPaletteHtml(palette), {
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

async function createPaletteHtml(palette: Palette) {
  const isDensePalette = palette.colors.length >= 6
  const logoDataUri = await readLogoDataUri()
  const colorItemWidth =
    (PALETTE_WIDTH - PALETTE_GAP * (palette.colors.length - 1)) /
    palette.colors.length
  const radius = Math.min(91, Math.round(colorItemWidth * 0.285))
  const colorNameSize = palette.colors.length <= 3 ? 24 : isDensePalette ? 18 : 22
  const colorCodeSize = palette.colors.length <= 3 ? 24 : isDensePalette ? 18 : 20
  const columns = palette.colors
    .map(
      (color) => `
        <section class="colorSection">
          <div class="colorItem" style="background: ${escapeHtml(color.hex)};">
            <div class="colorName" style="color: ${getReadableTextColor(color.hex)};">${escapeHtml(color.name)}</div>
          </div>
          <div class="colorCode">
            <div>HEX</div>
            <div>${escapeHtml(color.hex.toUpperCase())}</div>
          </div>
        </section>
      `,
    )
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
            background: #ffffff;
            color: #474f7a;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          .canvas {
            width: ${CANVAS_WIDTH}px;
            height: ${CANVAS_HEIGHT}px;
            position: relative;
            overflow: hidden;
          }

          .header {
            position: absolute;
            left: 216px;
            top: 161px;
            width: ${PALETTE_WIDTH}px;
            height: 88px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          h1 {
            margin: 0;
            color: #474f7a;
            font-size: 40px;
            line-height: normal;
            font-weight: 700;
            letter-spacing: 0;
            white-space: nowrap;
          }

          .logo {
            width: 363px;
            height: 88px;
            display: block;
            object-fit: contain;
          }

          .palette {
            position: absolute;
            left: 216px;
            top: 329px;
            width: ${PALETTE_WIDTH}px;
            height: 691px;
            display: grid;
            grid-template-columns: repeat(${palette.colors.length}, minmax(0, 1fr));
            gap: ${PALETTE_GAP}px;
            align-items: start;
          }

          .colorSection {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 40px;
          }

          .colorName {
            width: 100%;
            color: #ffffff;
            font-size: ${colorNameSize}px;
            line-height: normal;
            font-weight: 700;
            text-align: center;
            word-break: break-word;
          }

          .colorItem {
            width: 100%;
            height: 593px;
            padding: 0 ${isDensePalette ? 16 : 32}px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-top-left-radius: ${radius}px;
            border-top-right-radius: ${radius}px;
            border-bottom-right-radius: ${radius}px;
            border-bottom-left-radius: 0;
          }

          .colorCode {
            width: 100%;
            color: #474f7a;
            font-size: ${colorCodeSize}px;
            line-height: normal;
            font-weight: 700;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <main class="canvas">
          <header class="header">
            <h1>${escapeHtml(palette.paletteName)}</h1>
            <img class="logo" src="${logoDataUri}" alt="" />
          </header>

          <div class="palette">
            ${columns}
          </div>
        </main>
      </body>
    </html>
  `
}

async function readLogoDataUri() {
  const logo = await readFile(path.resolve("assets/logo.svg"))
  return `data:image/svg+xml;base64,${logo.toString("base64")}`
}

function getReadableTextColor(hex: string) {
  const normalized = hex.slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

  return luminance > 0.78 ? "#474f7a" : "#ffffff"
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
