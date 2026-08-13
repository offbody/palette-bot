import { clampRgb, formatHex } from "culori"
import type {
  Palette,
  PaletteColor,
  PaletteHarmony,
  PalettePreset,
  PaletteScoreBreakdown,
} from "../types.js"

const MIN_COLORS = 1
const MAX_COLORS = 5
const DEFAULT_PRESET: PalettePreset = "ui-soft"
const DEFAULT_CANDIDATE_COUNT = 40
const MAX_CANDIDATE_COUNT = 160

export const palettePresets = [
  "ui-soft",
  "editorial-bold",
  "minimal-neutral",
  "brand-vivid",
  "dark-interface",
] as const satisfies readonly PalettePreset[]

export const paletteHarmonies = [
  "analogous",
  "complementary",
  "triadic",
  "monochrome",
  "warm",
  "cool",
  "muted",
  "vivid",
] as const satisfies readonly PaletteHarmony[]

const paletteAdjectives = [
  "Amber",
  "Analog",
  "Arctic",
  "Ashen",
  "Astral",
  "Bare",
  "Beacon",
  "Binary",
  "Blended",
  "Blooming",
  "Brisk",
  "Calm",
  "Chromatic",
  "Cinder",
  "Clear",
  "Cloud",
  "Coastal",
  "Compact",
  "Copper",
  "Digital",
  "Diffuse",
  "Distant",
  "Drift",
  "Electric",
  "Ember",
  "Faint",
  "Fluid",
  "Frosted",
  "Glass",
  "Golden",
  "Graphite",
  "Grounded",
  "Halo",
  "Hidden",
  "Ionic",
  "Lateral",
  "Linear",
  "Lucid",
  "Lunar",
  "Magnetic",
  "Mineral",
  "Misty",
  "Modern",
  "Modular",
  "Muted",
  "Neon",
  "Nocturne",
  "Northern",
  "Open",
  "Optic",
  "Pastel",
  "Pixel",
  "Polar",
  "Prism",
  "Quiet",
  "Radiant",
  "Raw",
  "Remote",
  "Satin",
  "Sharp",
  "Signal",
  "Silken",
  "Solar",
  "Soft",
  "Static",
  "Still",
  "Studio",
  "Subtle",
  "Tactile",
  "Tonal",
  "Urban",
  "Velvet",
  "Virtual",
  "Vivid",
  "Warm",
  "Washed",
  "Wired",
]

const paletteNouns = [
  "Archive",
  "Atlas",
  "Balance",
  "Band",
  "Bloom",
  "Circuit",
  "Cloud",
  "Current",
  "Drift",
  "Field",
  "Filter",
  "Frame",
  "Garden",
  "Gradient",
  "Grid",
  "Harbor",
  "Horizon",
  "Index",
  "Interval",
  "Layer",
  "Light",
  "Map",
  "Matrix",
  "Memory",
  "Mesh",
  "Method",
  "Mist",
  "Mode",
  "Mood",
  "Noise",
  "North",
  "Orbit",
  "Palette",
  "Pattern",
  "Phase",
  "Plane",
  "Point",
  "Pulse",
  "Range",
  "Relay",
  "Rhythm",
  "Signal",
  "Sky",
  "Spectrum",
  "Stack",
  "State",
  "Stream",
  "Studio",
  "Weather",
  "System",
  "Tempo",
  "Trace",
  "Vector",
  "Vista",
  "Wave",
  "Window",
  "Zone",
]

const lightNames = [
  "Alabaster",
  "Bone",
  "Canvas",
  "Chalk",
  "Cloud",
  "Cotton",
  "Frost",
  "Glass",
  "Ivory",
  "Lace",
  "Linen",
  "Milk",
  "Mist",
  "Moon",
  "Opal",
  "Parchment",
  "Pearl",
  "Porcelain",
  "Rice",
  "Shell",
  "Snow",
  "Vellum",
]

const midNames = [
  "Basalt",
  "Cedar",
  "Clay",
  "Dove",
  "Drift",
  "Dust",
  "Flint",
  "Fog",
  "Haze",
  "Moss",
  "Ochre",
  "Olive",
  "Pebble",
  "Reed",
  "Sage",
  "Slate",
  "Smoke",
  "Stone",
  "Taupe",
  "Willow",
]

const neutralNames = [
  "Ash",
  "Cement",
  "Graphite",
  "Gravel",
  "Iron",
  "Lead",
  "Nickel",
  "Pewter",
  "Platinum",
  "Quartz",
  "Silver",
  "Steel",
]

const vividNames = [
  "Aqua",
  "Azure",
  "Berry",
  "Bolt",
  "Candy",
  "Coral",
  "Flare",
  "Glow",
  "Iris",
  "Laser",
  "Lime",
  "Pulse",
  "Rose",
  "Signal",
  "Spark",
  "Tango",
  "Vermilion",
  "Yuzu",
]

const darkNames = [
  "Carbon",
  "Charcoal",
  "Cocoa",
  "Eclipse",
  "Graphite",
  "Ink",
  "Licorice",
  "Midnight",
  "Night",
  "Obsidian",
  "Onyx",
  "Pine",
  "Pitch",
  "Raven",
  "Shadow",
  "Void",
]

const redNames = ["Brick", "Cardinal", "Cherry", "Crimson", "Garnet", "Ruby"]
const orangeNames = ["Amber", "Apricot", "Canyon", "Copper", "Marigold", "Tiger"]
const yellowNames = ["Citrine", "Honey", "Maize", "Saffron", "Sun", "Wheat"]
const greenNames = ["Fern", "Juniper", "Kiwi", "Laurel", "Mint", "Spruce"]
const cyanNames = ["Aqua", "Lagoon", "Pool", "Surf", "Teal", "Tide"]
const blueNames = ["Cobalt", "Denim", "Indigo", "Marine", "Sky", "Ultramarine"]
const violetNames = ["Amethyst", "Grape", "Lavender", "Lilac", "Orchid", "Violet"]
const magentaNames = ["Fuchsia", "Peony", "Plum", "Raspberry", "Rose", "Wine"]

type PresetConfig = {
  harmonies: readonly PaletteHarmony[]
  lightness: readonly number[]
  chroma: {
    low: number
    mid: number
    high: number
  }
  jitter: {
    hue: number
    lightness: number
    chroma: number
  }
}

const presetConfigs = {
  "ui-soft": {
    harmonies: paletteHarmonies,
    lightness: [0.94, 0.84, 0.72, 0.61, 0.5, 0.39, 0.29],
    chroma: { low: 0.035, mid: 0.09, high: 0.13 },
    jitter: { hue: 6, lightness: 0.025, chroma: 0.012 },
  },
  "editorial-bold": {
    harmonies: paletteHarmonies,
    lightness: [0.93, 0.8, 0.67, 0.55, 0.44, 0.33, 0.23],
    chroma: { low: 0.055, mid: 0.13, high: 0.19 },
    jitter: { hue: 8, lightness: 0.03, chroma: 0.016 },
  },
  "minimal-neutral": {
    harmonies: paletteHarmonies,
    lightness: [0.95, 0.86, 0.75, 0.63, 0.5, 0.37, 0.25],
    chroma: { low: 0.018, mid: 0.045, high: 0.07 },
    jitter: { hue: 4, lightness: 0.018, chroma: 0.008 },
  },
  "brand-vivid": {
    harmonies: paletteHarmonies,
    lightness: [0.92, 0.78, 0.66, 0.54, 0.43, 0.32, 0.22],
    chroma: { low: 0.065, mid: 0.15, high: 0.22 },
    jitter: { hue: 9, lightness: 0.03, chroma: 0.02 },
  },
  "dark-interface": {
    harmonies: paletteHarmonies,
    lightness: [0.82, 0.69, 0.56, 0.44, 0.33, 0.24, 0.16],
    chroma: { low: 0.03, mid: 0.085, high: 0.14 },
    jitter: { hue: 5, lightness: 0.02, chroma: 0.012 },
  },
} as const satisfies Record<PalettePreset, PresetConfig>

export type GeneratePaletteOptions = {
  colorCount: number
  seed?: string
  paletteName?: string
  preset?: PalettePreset
  harmony?: PaletteHarmony
  candidates?: number
  generatedAt?: string
}

type OklchColor = {
  l: number
  c: number
  h: number
}

type Candidate = {
  index: number
  harmony: PaletteHarmony
  colors: OklchColor[]
  hexColors: string[]
  score: number
  scoreBreakdown: PaletteScoreBreakdown
}

export function generatePalette(options: GeneratePaletteOptions): Palette {
  validateColorCount(options.colorCount)

  const seed = options.seed ?? new Date().toISOString().slice(0, 10)
  const preset = options.preset ?? DEFAULT_PRESET
  const candidateCount = normalizeCandidateCount(options.candidates)
  const bestCandidate = selectBestCandidate({
    colorCount: options.colorCount,
    seed,
    preset,
    harmony: options.harmony,
    candidateCount,
  })
  const random = createRandom(
    `${seed}:${preset}:${bestCandidate.harmony}:${bestCandidate.index}:name`,
  )
  const usedNames = new Set<string>()

  return {
    paletteName: options.paletteName ?? createPaletteName(random),
    colors: bestCandidate.colors.map((color, index) =>
      createPaletteColor(color, bestCandidate.hexColors[index]!, index, usedNames),
    ),
    metadata: {
      seed,
      generatedAt: options.generatedAt ?? createStableTimestamp(seed),
      colorCount: options.colorCount,
      preset,
      harmony: bestCandidate.harmony,
      candidateCount,
      selectedCandidate: bestCandidate.index + 1,
      score: bestCandidate.score,
      scoreBreakdown: bestCandidate.scoreBreakdown,
    },
  }
}

export function parsePalettePreset(value: string): PalettePreset {
  if (palettePresets.includes(value as PalettePreset)) {
    return value as PalettePreset
  }

  throw new Error(`Unknown palette preset: ${value}`)
}

export function parsePaletteHarmony(value: string): PaletteHarmony {
  if (paletteHarmonies.includes(value as PaletteHarmony)) {
    return value as PaletteHarmony
  }

  throw new Error(`Unknown palette harmony: ${value}`)
}

export function getPaletteHarmoniesForPreset(
  preset: PalettePreset,
): readonly PaletteHarmony[] {
  return presetConfigs[preset].harmonies
}

function selectBestCandidate(options: {
  colorCount: number
  seed: string
  preset: PalettePreset
  harmony?: PaletteHarmony
  candidateCount: number
}) {
  let bestCandidate: Candidate | undefined

  for (let index = 0; index < options.candidateCount; index += 1) {
    const random = createRandom(
      `${options.seed}:${options.preset}:${options.colorCount}:${index}`,
    )
    const harmony =
      options.harmony ?? pick(presetConfigs[options.preset].harmonies, random)
    const colors = buildOklchRamp(
      options.colorCount,
      createBaseHue(harmony, random),
      options.preset,
      harmony,
      random,
    )
    const hexColors = colors.map(toHex)
    const scoreBreakdown = scorePalette(colors, hexColors, harmony)
    const score = weightedScore(scoreBreakdown)
    const candidate = {
      index,
      harmony,
      colors,
      hexColors,
      score,
      scoreBreakdown,
    }

    if (!bestCandidate || candidate.score > bestCandidate.score) {
      bestCandidate = candidate
    }
  }

  if (!bestCandidate) {
    throw new Error("Could not generate a palette candidate.")
  }

  return bestCandidate
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

function normalizeCandidateCount(candidateCount?: number) {
  if (candidateCount === undefined) {
    return DEFAULT_CANDIDATE_COUNT
  }

  if (!Number.isInteger(candidateCount)) {
    throw new Error("Candidate count must be an integer.")
  }

  return clamp(candidateCount, 1, MAX_CANDIDATE_COUNT)
}

function buildOklchRamp(
  colorCount: number,
  baseHue: number,
  preset: PalettePreset,
  harmony: PaletteHarmony,
  random: () => number,
) {
  const config = presetConfigs[preset]
  const offsets = createHueOffsets(colorCount, harmony, random)
  const lightness = createLightnessRamp(colorCount, config, harmony)
  const chroma = createChromaRamp(colorCount, config, harmony)

  return offsets.map((offset, index) => ({
    l: clamp(
      lightness[index]! + randomBetween(random, -config.jitter.lightness, config.jitter.lightness),
      0.14,
      0.96,
    ),
    c: clamp(
      chroma[index]! + randomBetween(random, -config.jitter.chroma, config.jitter.chroma),
      0.012,
      0.24,
    ),
    h: wrapHue(baseHue + offset + randomBetween(random, -config.jitter.hue, config.jitter.hue)),
  }))
}

function createBaseHue(harmony: PaletteHarmony, random: () => number) {
  if (harmony === "warm") {
    return random() > 0.32
      ? randomBetween(random, 12, 76)
      : randomBetween(random, 326, 358)
  }

  if (harmony === "cool") {
    return randomBetween(random, 178, 266)
  }

  return Math.round(random() * 360)
}

function createHueOffsets(
  colorCount: number,
  harmony: PaletteHarmony,
  random: () => number,
) {
  if (harmony === "complementary") {
    return balancedOffsets(
      pick(
        [
          [0, 180, 24, 204, -24],
          [0, 172, 188, 34, 214],
          [0, 150, 210, -28, 182],
          [0, 180, 60, 240, 300],
        ],
        random,
      ),
      colorCount,
    )
  }

  if (harmony === "triadic") {
    return balancedOffsets(
      pick(
        [
          [0, 120, 240, 28, 148],
          [0, 112, 232, -24, 256],
          [0, 128, 248, 48, 288],
          [0, 96, 216, 144, 264],
        ],
        random,
      ),
      colorCount,
    )
  }

  if (harmony === "monochrome") {
    const spread = randomBetween(random, 6, 22)
    return createArcOffsets(colorCount, spread)
  }

  if (harmony === "warm" || harmony === "cool") {
    return createArcOffsets(colorCount, randomBetween(random, 48, 112))
  }

  if (harmony === "muted") {
    return createArcOffsets(colorCount, randomBetween(random, 28, 74))
  }

  if (harmony === "vivid") {
    return balancedOffsets(
      pick(
        [
          [0, 96, 192, 288, 48],
          [0, 72, 168, 264, 336],
          [0, 110, 220, 36, 300],
          [0, 84, 204, 276, 144],
        ],
        random,
      ),
      colorCount,
    )
  }

  return createArcOffsets(colorCount, randomBetween(random, 46, 118))
}

function balancedOffsets(offsets: readonly number[], colorCount: number) {
  return offsets.slice(0, colorCount)
}

function createArcOffsets(colorCount: number, spread: number) {
  if (colorCount === 1) {
    return [0]
  }

  const start = -spread / 2
  const step = spread / (colorCount - 1)

  return Array.from({ length: colorCount }, (_, index) => start + step * index)
}

function createLightnessRamp(
  colorCount: number,
  config: PresetConfig,
  harmony: PaletteHarmony,
) {
  const ramp = config.lightness.slice(0, colorCount)

  if (harmony === "monochrome") {
    return ramp.map((lightness, index) =>
      clamp(lightness + (index % 2 === 0 ? 0.015 : -0.015), 0.14, 0.96),
    )
  }

  return ramp
}

function createChromaRamp(
  colorCount: number,
  config: PresetConfig,
  harmony: PaletteHarmony,
) {
  const harmonyMultiplier = getHarmonyChromaMultiplier(harmony)

  return Array.from({ length: colorCount }, (_, index) => {
    const position = colorCount === 1 ? 0 : index / (colorCount - 1)

    if (index === 0) {
      return config.chroma.low * harmonyMultiplier
    }

    if (index === colorCount - 1) {
      return (config.chroma.low + config.chroma.mid) * 0.52 * harmonyMultiplier
    }

    const arc = Math.sin(position * Math.PI)
    return (config.chroma.mid + (config.chroma.high - config.chroma.mid) * arc) * harmonyMultiplier
  })
}

function getHarmonyChromaMultiplier(harmony: PaletteHarmony) {
  if (harmony === "muted" || harmony === "monochrome") return 0.62
  if (harmony === "vivid") return 1.12
  return 1
}

function scorePalette(
  colors: readonly OklchColor[],
  hexColors: readonly string[],
  harmony: PaletteHarmony,
): PaletteScoreBreakdown {
  return {
    contrast: scoreContrast(hexColors),
    separation: scoreSeparation(colors),
    harmony: scoreHarmony(colors, harmony),
    lightness: scoreLightness(colors),
    usability: scoreUsability(colors, hexColors),
  }
}

function weightedScore(score: PaletteScoreBreakdown) {
  return roundScore(
    score.contrast * 0.27 +
      score.separation * 0.22 +
      score.harmony * 0.2 +
      score.lightness * 0.16 +
      score.usability * 0.15,
  )
}

function scoreContrast(hexColors: readonly string[]) {
  if (hexColors.length < 2) {
    return 100
  }

  const luminance = hexColors.map(getRelativeLuminance)
  const sorted = [...luminance].sort((a, b) => a - b)
  const maxContrast = contrastRatio(sorted[0]!, sorted[sorted.length - 1]!)
  const neighborContrast = sorted
    .slice(1)
    .map((value, index) => contrastRatio(sorted[index]!, value))
  const averageNeighborContrast =
    neighborContrast.reduce((sum, value) => sum + value, 0) /
    Math.max(1, neighborContrast.length)

  return roundScore(
    clamp01((maxContrast - 3.4) / 6.2) * 72 +
      clamp01((averageNeighborContrast - 1.18) / 1.35) * 28,
  )
}

function scoreSeparation(colors: readonly OklchColor[]) {
  if (colors.length < 2) {
    return 100
  }

  const nearestDistances = colors.map((color, index) => {
    const distances = colors
      .filter((_, comparedIndex) => comparedIndex !== index)
      .map((comparedColor) => oklchDistance(color, comparedColor))

    return Math.min(...distances)
  })
  const averageNearest =
    nearestDistances.reduce((sum, distance) => sum + distance, 0) /
    nearestDistances.length

  return roundScore(clamp01((averageNearest - 0.08) / 0.21) * 100)
}

function scoreHarmony(colors: readonly OklchColor[], harmony: PaletteHarmony) {
  if (colors.length < 2) {
    return 100
  }

  const hueSpan = getHueSpan(colors.map((color) => color.h))

  if (harmony === "monochrome") {
    return roundScore(100 - clamp01((hueSpan - 16) / 52) * 80)
  }

  if (harmony === "analogous" || harmony === "muted" || harmony === "warm" || harmony === "cool") {
    return roundScore(100 - clamp01((hueSpan - 68) / 130) * 65)
  }

  if (harmony === "triadic" || harmony === "vivid") {
    return roundScore(clamp01((hueSpan - 150) / 120) * 100)
  }

  return roundScore(clamp01((hueSpan - 112) / 96) * 100)
}

function scoreLightness(colors: readonly OklchColor[]) {
  if (colors.length < 2) {
    return 100
  }

  const lightness = colors.map((color) => color.l).sort((a, b) => a - b)
  const span = lightness[lightness.length - 1]! - lightness[0]!
  const deltas = lightness.slice(1).map((value, index) => value - lightness[index]!)
  const tightestDelta = Math.min(...deltas)

  return roundScore(
    clamp01((span - 0.48) / 0.28) * 68 +
      clamp01((tightestDelta - 0.055) / 0.08) * 32,
  )
}

function scoreUsability(
  colors: readonly OklchColor[],
  hexColors: readonly string[],
) {
  const uniqueHexCount = new Set(hexColors).size
  const uniqueness = uniqueHexCount / hexColors.length
  const lowChromaDarkColors = colors.filter(
    (color) => color.l < 0.34 && color.c < 0.035,
  ).length
  const overlyBrightVividColors = colors.filter(
    (color) => color.l > 0.84 && color.c > 0.14,
  ).length

  return roundScore(
    uniqueness * 72 -
      lowChromaDarkColors * 8 -
      overlyBrightVividColors * 7 +
      28,
  )
}

function createPaletteColor(
  color: OklchColor,
  hex: string,
  index: number,
  usedNames: Set<string>,
): PaletteColor {
  return {
    name: createColorName(color, hex, index, usedNames),
    hex,
  }
}

function toHex(color: OklchColor) {
  return formatHex(
    clampRgb({
      mode: "oklch",
      l: clamp(color.l, 0.14, 0.96),
      c: clamp(color.c, 0.012, 0.24),
      h: wrapHue(color.h),
    }),
  ).toUpperCase()
}

function createColorName(
  color: OklchColor,
  hex: string,
  index: number,
  usedNames: Set<string>,
) {
  const names = getNameCandidates(color, index)
  const startIndex = hashString(`${hex}:${index}`) % names.length

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
  const toneNames =
    index === 0 || color.l >= 0.88
      ? lightNames
      : color.l <= 0.36
        ? darkNames
        : color.c < 0.045
          ? neutralNames
          : color.c >= 0.13
            ? vividNames
            : midNames

  return unique([...toneNames, ...getHueNameCandidates(color.h)])
}

function getHueNameCandidates(hue: number) {
  const wrappedHue = wrapHue(hue)

  if (wrappedHue < 18 || wrappedHue >= 346) return redNames
  if (wrappedHue < 54) return orangeNames
  if (wrappedHue < 86) return yellowNames
  if (wrappedHue < 154) return greenNames
  if (wrappedHue < 196) return cyanNames
  if (wrappedHue < 254) return blueNames
  if (wrappedHue < 302) return violetNames
  return magentaNames
}

function createPaletteName(random: () => number) {
  return `${pick(paletteAdjectives, random)} ${pick(paletteNouns, random)}`
}

function createStableTimestamp(seed: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(seed)) {
    return `${seed}T00:00:00.000Z`
  }

  const random = createRandom(`${seed}:timestamp`)
  const dayOffset = Math.floor(random() * 730)
  const timestamp = new Date(Date.UTC(2024, 0, 1 + dayOffset))

  return timestamp.toISOString()
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

function unique<T>(items: readonly T[]) {
  return Array.from(new Set(items))
}

function hashString(value: string) {
  let hash = 2166136261

  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function randomBetween(random: () => number, min: number, max: number) {
  return min + (max - min) * random()
}

function oklchDistance(first: OklchColor, second: OklchColor) {
  const hueDistance = Math.min(
    Math.abs(first.h - second.h),
    360 - Math.abs(first.h - second.h),
  )

  return (
    Math.abs(first.l - second.l) * 1.35 +
    Math.abs(first.c - second.c) * 1.1 +
    (hueDistance / 360) * 0.82
  )
}

function getHueSpan(hues: readonly number[]) {
  const sortedHues = hues.map(wrapHue).sort((a, b) => a - b)
  const gaps = sortedHues.map((hue, index) => {
    const nextHue = sortedHues[(index + 1) % sortedHues.length]!
    return wrapHue(nextHue - hue)
  })
  const largestGap = Math.max(...gaps)

  return 360 - largestGap
}

function getRelativeLuminance(hex: string) {
  const red = parseInt(hex.slice(1, 3), 16) / 255
  const green = parseInt(hex.slice(3, 5), 16) / 255
  const blue = parseInt(hex.slice(5, 7), 16) / 255

  return (
    0.2126 * linearizeRgb(red) +
    0.7152 * linearizeRgb(green) +
    0.0722 * linearizeRgb(blue)
  )
}

function linearizeRgb(value: number) {
  return value <= 0.03928
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4
}

function contrastRatio(firstLuminance: number, secondLuminance: number) {
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

function wrapHue(hue: number) {
  return ((hue % 360) + 360) % 360
}

function clamp01(value: number) {
  return clamp(value, 0, 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundScore(score: number) {
  return Math.round(clamp(score, 0, 100))
}
