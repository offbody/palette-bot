import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"
import type { Palette } from "../types.js"

const CANVAS_WIDTH = 1440
const CANVAS_HEIGHT = 1153
const MIN_COLORS = 1
const MAX_COLORS = 5
const FIGMA_PALETTE_WIDTH = 1008
const FIGMA_PALETTE_GAP = 24
const INTER_FONT_PATH = path.resolve(
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
)

let interFontFaceCss: string | undefined

export type RenderPaletteTheme = "technical" | "figma"

export type RenderPaletteOptions = {
  outputPath: string
  theme?: RenderPaletteTheme
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
    await page.setContent(await createPaletteHtml(palette, options.theme), {
      waitUntil: "networkidle",
    })
    await page.evaluate(() => document.fonts.ready)
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

async function createPaletteHtml(
  palette: Palette,
  theme: RenderPaletteTheme = "technical",
) {
  if (theme === "figma") {
    return createFigmaPaletteHtml(palette)
  }

  return createTechnicalPaletteHtml(palette)
}

async function createTechnicalPaletteHtml(palette: Palette) {
  const fontFaceCss = await readInterFontFaceCss()
  const columns = palette.colors
    .map((color, index) => {
      const textColor = getTechnicalTextColor(color.hex)

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

  return createHtmlDocument(`
    <style>
      ${fontFaceCss}

      * {
        box-sizing: border-box;
      }

      body {
        width: ${CANVAS_WIDTH}px;
        height: ${CANVAS_HEIGHT}px;
        margin: 0;
        background: #f2eee6;
        color: #171717;
        font-family: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
        font-weight: 400;
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
        font-size: ${palette.colors.length <= 4 ? "38px" : "30px"};
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
    <main class="canvas">
      <header class="header">
        <div>
          <div class="eyebrow">Color Palette</div>
          <h1>${escapeHtml(palette.paletteName)}</h1>
        </div>
        <div class="count">${formatColorCount(palette.colors.length)}</div>
      </header>

      <div class="palette">
        ${columns}
      </div>

      <footer class="footer">
        <div>UI/UX/Design & Colors</div>
        <div class="rule"></div>
        <div>t.me/color_palettes</div>
      </footer>
    </main>
  `)
}

async function createFigmaPaletteHtml(palette: Palette) {
  const fontFaceCss = await readInterFontFaceCss()
  const logoDataUri = await readLogoDataUri()
  const colorItemWidth =
    (FIGMA_PALETTE_WIDTH - FIGMA_PALETTE_GAP * (palette.colors.length - 1)) /
    palette.colors.length
  const radius = Math.min(91, Math.round(colorItemWidth * 0.285))
  const colorNameSize = palette.colors.length <= 3 ? 24 : 22
  const colorCodeSize = palette.colors.length <= 3 ? 24 : 20
  const columns = palette.colors
    .map(
      (color) => `
        <section class="colorSection">
          <div class="colorItem" style="background: ${escapeHtml(color.hex)};">
            <div class="colorName" style="color: ${getFigmaTextColor(color.hex)};">${escapeHtml(color.name)}</div>
          </div>
          <div class="colorCode">
            <div>HEX</div>
            <div>${escapeHtml(color.hex.toUpperCase())}</div>
          </div>
        </section>
      `,
    )
    .join("")

  return createHtmlDocument(`
    <style>
      ${fontFaceCss}

      * {
        box-sizing: border-box;
      }

      body {
        width: ${CANVAS_WIDTH}px;
        height: ${CANVAS_HEIGHT}px;
        margin: 0;
        background: #ffffff;
        color: #474f7a;
        font-family: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
        width: ${FIGMA_PALETTE_WIDTH}px;
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
        font-weight: 400;
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
        width: ${FIGMA_PALETTE_WIDTH}px;
        height: 691px;
        display: grid;
        grid-template-columns: repeat(${palette.colors.length}, minmax(0, 1fr));
        gap: ${FIGMA_PALETTE_GAP}px;
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
        overflow-wrap: normal;
        word-break: normal;
      }

      .colorItem {
        width: 100%;
        height: 593px;
        padding: 0 24px;
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
    <main class="canvas">
      <header class="header">
        <h1>${escapeHtml(palette.paletteName)}</h1>
        <img class="logo" src="${logoDataUri}" alt="" />
      </header>

      <div class="palette">
        ${columns}
      </div>
    </main>
  `)
}

function createHtmlDocument(bodyContent: string) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        ${bodyContent}
      </body>
    </html>
  `
}

async function readLogoDataUri() {
  const logo = await readFile(path.resolve("assets/logo.svg"))
  return `data:image/svg+xml;base64,${logo.toString("base64")}`
}

async function readInterFontFaceCss() {
  if (interFontFaceCss) {
    return interFontFaceCss
  }

  const font = await readFile(INTER_FONT_PATH)
  interFontFaceCss = `
    @font-face {
      font-family: "Inter";
      src: url("data:font/woff2;base64,${font.toString("base64")}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
    }
  `

  return interFontFaceCss
}

function getTechnicalTextColor(hex: string) {
  return getRelativeLuminance(hex) > 0.62 ? "#171717" : "#fffaf0"
}

function getFigmaTextColor(hex: string) {
  return getRelativeLuminance(hex) > 0.78 ? "#474f7a" : "#ffffff"
}

function getRelativeLuminance(hex: string) {
  const normalized = hex.slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)

  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255
}

function formatColorCount(colorCount: number) {
  return `${colorCount} ${colorCount === 1 ? "color" : "colors"}`
}

export function parseRenderPaletteTheme(value: string): RenderPaletteTheme {
  if (value === "technical" || value === "figma") {
    return value
  }

  throw new Error(`Unknown render theme: ${value}`)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
