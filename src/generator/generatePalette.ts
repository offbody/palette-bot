import { clampRgb, formatHex } from "culori"
import type { Palette, PaletteColor } from "../types.js"

const MIN_COLORS = 2
const MAX_COLORS = 7

const paletteAdjectives = [
  "Quiet",
  "Solar",
  "Mineral",
  "Velvet",
  "Lucid",
  "Signal",
  "Drift",
  "Cinder",
]

const paletteNouns = [
  "Bloom",
  "Field",
  "Current",
  "Garden",
  "Horizon",
  "Archive",
  "Interval",
  "Weather",
]

const lightNames = ["Porcelain", "Linen", "Chalk", "Parchment", "Pearl"]
const midNames = ["Sage", "Clay", "Moss", "Ochre", "Dust", "Cedar"]
const vividNames = ["Yuzu", "Coral", "Berry", "Azure", "Vermilion", "Iris"]
const darkNames = ["Ink", "Graphite", "Night", "Carbon", "Pine"]

export type GeneratePaletteOptions = {
  colorCount: number
  seed?: string
  paletteName?: string
}

type OklchColor = {
  l: number
  c: number
  h: number
}

export function generatePalette(options: GeneratePaletteOptions): Palette {
  validateColorCount(options.colorCount)

  const seed = options.seed ?? new Date().toISOString().slice(0, 10)
  const random = createRandom(`${seed}:${options.colorCount}`)
  const baseHue = Math.round(random() * 360)
  const profile = pick(
    ["analogous", "split", "triad", "arc"] as const,
    random,
  )
  const colors = buildOklchRamp(options.colorCount, baseHue, profile, random)

  const usedNames = new Set<string>()

  return {
    paletteName: options.paletteName ?? createPaletteName(random),
    colors: colors.map((color, index) =>
      createPaletteColor(color, index, usedNames),
    ),
  }
}

function validateColorCount(colorCount: number) {
  if (!Number.isInteger(colorCount)) {
    throw new Error("Color count must be an integer.")
  }

  if (colorCount < MIN_COLORS || colorCount > MAX_COLORS) {
    throw new Error(
      `Color count must be between ${MIN_COLORS} and ${MAX_COLORS}.`,
    )
  }
}

function buildOklchRamp(
  colorCount: number,
  baseHue: number,
  profile: "analogous" | "split" | "triad" | "arc",
  random: () => number,
) {
  const offsets = createHueOffsets(colorCount, profile)
  const lightness = createLightnessRamp(colorCount)
  const chroma = createChromaRamp(colorCount, profile)

  return offsets.map((offset, index) => ({
    l: lightness[index],
    c: chroma[index] + randomBetween(random, -0.012, 0.012),
    h: wrapHue(baseHue + offset + randomBetween(random, -6, 6)),
  }))
}

function createHueOffsets(
  colorCount: number,
  profile: "analogous" | "split" | "triad" | "arc",
) {
  if (profile === "split") {
    const splitOffsets = [-34, 0, 34, 150, 184, 218, 252]
    return splitOffsets.slice(0, colorCount)
  }

  if (profile === "triad") {
    const triadOffsets = [0, 120, 240, 24, 144, 264, 312]
    return triadOffsets.slice(0, colorCount)
  }

  const spread = profile === "arc" ? 168 : Math.min(96, 20 * colorCount)
  const start = -spread / 2
  const step = spread / (colorCount - 1)

  return Array.from({ length: colorCount }, (_, index) => start + step * index)
}

function createLightnessRamp(colorCount: number) {
  if (colorCount === 2) {
    return [0.92, 0.3]
  }

  return [0.94, 0.84, 0.72, 0.61, 0.5, 0.39, 0.28].slice(0, colorCount)
}

function createChromaRamp(
  colorCount: number,
  profile: "analogous" | "split" | "triad" | "arc",
) {
  const base = profile === "analogous" ? 0.08 : 0.11
  const vividBoost = profile === "triad" || profile === "split" ? 0.035 : 0.02

  return Array.from({ length: colorCount }, (_, index) => {
    if (index === 0) return 0.035
    if (index === colorCount - 1) return 0.055
    return base + vividBoost * Math.sin((index / (colorCount - 1)) * Math.PI)
  })
}

function createPaletteColor(
  color: OklchColor,
  index: number,
  usedNames: Set<string>,
): PaletteColor {
  return {
    name: createColorName(color, index, usedNames),
    hex: formatHex(
      clampRgb({
        mode: "oklch",
        l: clamp(color.l, 0.18, 0.96),
        c: clamp(color.c, 0.02, 0.18),
        h: wrapHue(color.h),
      }),
    ).toUpperCase(),
  }
}

function createColorName(
  color: OklchColor,
  index: number,
  usedNames: Set<string>,
) {
  const names = getNameCandidates(color, index)
  const startIndex = Math.floor((wrapHue(color.h) / 360) * names.length)

  for (let offset = 0; offset < names.length; offset += 1) {
    const name = names[(startIndex + offset) % names.length]!

    if (!usedNames.has(name)) {
      usedNames.add(name)
      return name
    }
  }

  const fallbackName = `${names[startIndex]} ${index + 1}`
  usedNames.add(fallbackName)
  return fallbackName
}

function getNameCandidates(color: OklchColor, index: number) {
  if (index === 0 || color.l >= 0.88) return lightNames
  if (color.l <= 0.36) return darkNames
  if (color.c >= 0.13) return vividNames
  return midNames
}

function createPaletteName(random: () => number) {
  return `${pick(paletteAdjectives, random)} ${pick(paletteNouns, random)}`
}

function createRandom(seed: string) {
  let state = 1779033703 ^ seed.length

  for (const character of seed) {
    state = Math.imul(state ^ character.charCodeAt(0), 3432918353)
    state = (state << 13) | (state >>> 19)
  }

  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507)
    state = Math.imul(state ^ (state >>> 13), 3266489909)
    state ^= state >>> 16
    return (state >>> 0) / 4294967296
  }
}

function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.floor(random() * items.length)]!
}

function pickByHue(items: readonly string[], hue: number) {
  return items[Math.floor((wrapHue(hue) / 360) * items.length) % items.length]!
}

function randomBetween(random: () => number, min: number, max: number) {
  return min + (max - min) * random()
}

function wrapHue(hue: number) {
  return ((hue % 360) + 360) % 360
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
