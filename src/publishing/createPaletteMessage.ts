import type { Palette } from "../types.js"

export function createPaletteMessage(palette: Palette) {
  return palette.colors
    .map(
      (color) => `${normalizeWhitespace(color.name)} ${color.hex.toUpperCase()}`,
    )
    .join("\n")
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}
