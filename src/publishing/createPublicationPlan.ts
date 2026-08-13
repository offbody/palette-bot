import {
  getPaletteHarmoniesForPreset,
  parsePaletteHarmony,
  parsePalettePreset,
} from "../generator/generatePalette.js"
import type {
  PaletteHarmony,
  PalettePreset,
  PalettePublicationPlan,
} from "../types.js"

export type CreatePublicationPlanOptions = {
  date?: string
  seed?: string
  colorCount?: number
  preset?: string
  harmony?: string
  candidates?: number
  rendererTheme?: "technical" | "figma"
  strategyAttempt?: number
}

type WeightedOption<T> = {
  value: T
  weight: number
}

const colorCountWeights = [
  { value: 2, weight: 8 },
  { value: 3, weight: 22 },
  { value: 4, weight: 34 },
  { value: 5, weight: 36 },
] as const satisfies readonly WeightedOption<number>[]

const presetWeights = [
  { value: "ui-soft", weight: 30 },
  { value: "brand-vivid", weight: 22 },
  { value: "editorial-bold", weight: 18 },
  { value: "minimal-neutral", weight: 16 },
  { value: "dark-interface", weight: 14 },
] as const satisfies readonly WeightedOption<PalettePreset>[]

const candidateCounts = {
  "ui-soft": 40,
  "editorial-bold": 56,
  "minimal-neutral": 36,
  "brand-vivid": 56,
  "dark-interface": 44,
} as const satisfies Record<PalettePreset, number>

export function createPublicationPlan(
  options: CreatePublicationPlanOptions = {},
): PalettePublicationPlan {
  const date = options.date ?? new Date().toISOString().slice(0, 10)
  validateDate(date)

  const baseSeed = options.seed ?? `post:${date}`
  const strategyAttempt = options.strategyAttempt ?? 1
  validateStrategyAttempt(strategyAttempt)

  const seed =
    strategyAttempt === 1
      ? baseSeed
      : `${baseSeed}:strategy-${strategyAttempt}`
  const random = createRandom(`${baseSeed}:publication-plan:${strategyAttempt}`)
  const colorCount = options.colorCount ?? pickWeighted(colorCountWeights, random)
  validateColorCount(colorCount)

  const requestedPreset = options.preset
    ? parsePalettePreset(options.preset)
    : undefined
  const requestedHarmony = options.harmony
    ? parsePaletteHarmony(options.harmony)
    : undefined
  const compatiblePresetWeights = requestedHarmony
    ? presetWeights.filter((presetWeight) =>
        getPaletteHarmoniesForPreset(presetWeight.value).includes(
          requestedHarmony,
        ),
      )
    : presetWeights
  const preset = requestedPreset ?? pickWeighted(compatiblePresetWeights, random)
  const presetHarmonies = getPaletteHarmoniesForPreset(preset)
  const harmony =
    requestedHarmony && presetHarmonies.includes(requestedHarmony)
      ? requestedHarmony
      : pick(presetHarmonies, random)

  validatePresetHarmony(preset, harmony)

  const candidates = options.candidates ?? candidateCounts[preset]
  validateCandidates(candidates)

  return {
    date,
    seed,
    strategyAttempt,
    colorCount,
    preset,
    harmony,
    candidates,
    rendererTheme: options.rendererTheme ?? "figma",
  }
}

function validateDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Publication date must use YYYY-MM-DD format.")
  }
}

function validateColorCount(colorCount: number) {
  if (!Number.isInteger(colorCount) || colorCount < 1 || colorCount > 5) {
    throw new Error("Publication color count must be between 1 and 5.")
  }
}

function validateCandidates(candidates: number) {
  if (!Number.isInteger(candidates) || candidates < 1 || candidates > 160) {
    throw new Error("Publication candidates must be between 1 and 160.")
  }
}

function validateStrategyAttempt(strategyAttempt: number) {
  if (
    !Number.isInteger(strategyAttempt) ||
    strategyAttempt < 1 ||
    strategyAttempt > 64
  ) {
    throw new Error("Publication strategy attempt must be between 1 and 64.")
  }
}

function validatePresetHarmony(
  preset: PalettePreset,
  harmony: PaletteHarmony,
) {
  if (!getPaletteHarmoniesForPreset(preset).includes(harmony)) {
    throw new Error(`Harmony ${harmony} is not supported for preset ${preset}.`)
  }
}

function pickWeighted<T>(
  items: readonly WeightedOption<T>[],
  random: () => number,
) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let threshold = random() * totalWeight

  for (const item of items) {
    threshold -= item.weight

    if (threshold <= 0) {
      return item.value
    }
  }

  return items[items.length - 1]!.value
}

function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.floor(random() * items.length)]!
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
