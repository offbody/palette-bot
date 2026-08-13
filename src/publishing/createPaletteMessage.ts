import type { Palette } from "../types.js"

export function createPaletteMessage(palette: Palette) {
  const title = `<b>${escapeHtml(normalizeWhitespace(palette.paletteName))}</b>`
  const colors = palette.colors
    .map((color) =>
      [
        escapeHtml(normalizeWhitespace(color.name)),
        color.hex.toUpperCase(),
      ].join(" "),
    )
    .join("\n")

  return `${title}\n\n${colors}`
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}
