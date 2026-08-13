import { getPaletteHarmoniesForPreset } from "../generator/generatePalette.js"
import { createPublicationPlan } from "../publishing/createPublicationPlan.js"

const firstPlan = createPublicationPlan({ date: "2026-08-13" })
const secondPlan = createPublicationPlan({ date: "2026-08-13" })

if (JSON.stringify(firstPlan) !== JSON.stringify(secondPlan)) {
  throw new Error("Publication plan is not deterministic for the same date.")
}

const presets = new Set<string>()
const harmonies = new Set<string>()
const colorCounts = new Set<number>()

for (let day = 1; day <= 30; day += 1) {
  const date = `2026-08-${String(day).padStart(2, "0")}`
  const plan = createPublicationPlan({ date })

  presets.add(plan.preset)
  harmonies.add(plan.harmony)
  colorCounts.add(plan.colorCount)

  if (!getPaletteHarmoniesForPreset(plan.preset).includes(plan.harmony)) {
    throw new Error(
      `Invalid strategy pair for ${date}: ${plan.preset}/${plan.harmony}.`,
    )
  }

  if (plan.rendererTheme !== "figma") {
    throw new Error(`Unexpected default renderer theme: ${plan.rendererTheme}`)
  }
}

if (presets.size < 4) {
  throw new Error(`Expected at least 4 presets across a month; received ${presets.size}.`)
}

if (harmonies.size < 5) {
  throw new Error(
    `Expected at least 5 harmonies across a month; received ${harmonies.size}.`,
  )
}

if (colorCounts.size < 4) {
  throw new Error(
    `Expected at least 4 color counts across a month; received ${colorCounts.size}.`,
  )
}

const overridePlan = createPublicationPlan({
  date: "2026-08-13",
  colorCount: 5,
  preset: "brand-vivid",
  harmony: "triadic",
  candidates: 32,
  rendererTheme: "figma",
})

if (
  overridePlan.colorCount !== 5 ||
  overridePlan.preset !== "brand-vivid" ||
  overridePlan.harmony !== "triadic" ||
  overridePlan.candidates !== 32 ||
  overridePlan.rendererTheme !== "figma"
) {
  throw new Error("Publication strategy overrides were not applied.")
}

const harmonyOnlyPlan = createPublicationPlan({
  date: "2026-08-13",
  harmony: "warm",
})

if (!getPaletteHarmoniesForPreset(harmonyOnlyPlan.preset).includes("warm")) {
  throw new Error(
    `Harmony-only override chose incompatible preset ${harmonyOnlyPlan.preset}.`,
  )
}

const conflictingOverridePlan = createPublicationPlan({
  date: "2026-08-13",
  preset: "minimal-neutral",
  harmony: "warm",
})

if (
  conflictingOverridePlan.preset !== "minimal-neutral" ||
  !getPaletteHarmoniesForPreset("minimal-neutral").includes(
    conflictingOverridePlan.harmony,
  )
) {
  throw new Error("Conflicting preset/harmony override was not resolved.")
}

console.log(
  `Publication strategy: ${presets.size} presets, ${harmonies.size} harmonies, ${colorCounts.size} color counts.`,
)
