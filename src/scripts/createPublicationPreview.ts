import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { generatePalette } from "../generator/generatePalette.js"
import { createPublicationPlan } from "../publishing/createPublicationPlan.js"
import {
  parseRenderPaletteTheme,
  renderPalette,
} from "../render/renderPalette.js"
import type { Palette, PalettePublicationPlan } from "../types.js"

const args = parseArgs(process.argv.slice(2))
const planPath = path.resolve(args.plan ?? "output/post-plan.json")
const jsonPath = path.resolve(args.json ?? "output/post-palette.json")
const pngPath = path.resolve(args.png ?? "output/post-palette.png")
const rendererTheme = args.theme
  ? parseRenderPaletteTheme(args.theme)
  : undefined
const colorCount = args.colors ? Number.parseInt(args.colors, 10) : undefined
const candidates = args.candidates
  ? Number.parseInt(args.candidates, 10)
  : undefined
const strategyAttempts = args.attempts
  ? Number.parseInt(args.attempts, 10)
  : 12
const minimumScore = args["min-score"]
  ? Number.parseInt(args["min-score"], 10)
  : 70

const { plan, palette } = createPreview({
  date: args.date,
  seed: args.seed,
  colorCount,
  preset: args.preset,
  harmony: args.harmony,
  candidates,
  rendererTheme,
  strategyAttempts,
  minimumScore,
})

await Promise.all([
  mkdir(path.dirname(planPath), { recursive: true }),
  mkdir(path.dirname(jsonPath), { recursive: true }),
  mkdir(path.dirname(pngPath), { recursive: true }),
])
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8")
await writeFile(jsonPath, `${JSON.stringify(palette, null, 2)}\n`, "utf8")
await renderPalette(palette, {
  outputPath: pngPath,
  theme: plan.rendererTheme,
})

console.log(`Planned ${path.relative(process.cwd(), planPath)}`)
console.log(`Generated ${path.relative(process.cwd(), jsonPath)}`)
console.log(`Rendered ${path.relative(process.cwd(), pngPath)}`)

function createPreview(options: {
  date?: string
  seed?: string
  colorCount?: number
  preset?: string
  harmony?: string
  candidates?: number
  rendererTheme?: "technical" | "figma"
  strategyAttempts: number
  minimumScore: number
}) {
  validateStrategyAttempts(options.strategyAttempts)
  validateMinimumScore(options.minimumScore)

  let bestPreview:
    | {
        plan: PalettePublicationPlan
        palette: Palette
      }
    | undefined

  for (
    let strategyAttempt = 1;
    strategyAttempt <= options.strategyAttempts;
    strategyAttempt += 1
  ) {
    const plan = createPublicationPlan({
      date: options.date,
      seed: options.seed,
      colorCount: options.colorCount,
      preset: options.preset,
      harmony: options.harmony,
      candidates: options.candidates,
      rendererTheme: options.rendererTheme,
      strategyAttempt,
    })
    const palette = generatePalette({
      colorCount: plan.colorCount,
      seed: plan.seed,
      preset: plan.preset,
      harmony: plan.harmony,
      candidates: plan.candidates,
      generatedAt: `${plan.date}T00:00:00.000Z`,
    })

    if (
      !bestPreview ||
      (palette.metadata?.score ?? 0) > (bestPreview.palette.metadata?.score ?? 0)
    ) {
      bestPreview = { plan, palette }
    }
  }

  if (!bestPreview) {
    throw new Error("Could not create a publication preview.")
  }

  if ((bestPreview.palette.metadata?.score ?? 0) < options.minimumScore) {
    throw new Error(
      `Best publication score ${(bestPreview.palette.metadata?.score ?? 0)} is below ${options.minimumScore}.`,
    )
  }

  return bestPreview
}

function validateStrategyAttempts(strategyAttempts: number) {
  if (
    !Number.isInteger(strategyAttempts) ||
    strategyAttempts < 1 ||
    strategyAttempts > 64
  ) {
    throw new Error("Publication preview attempts must be between 1 and 64.")
  }
}

function validateMinimumScore(minimumScore: number) {
  if (!Number.isInteger(minimumScore) || minimumScore < 1 || minimumScore > 100) {
    throw new Error("Publication preview minimum score must be between 1 and 100.")
  }
}

function parseArgs(rawArgs: string[]) {
  const parsed: Record<string, string> = {}

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]

    if (arg === "--") {
      continue
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`)
    }

    const key = arg.slice(2)
    const value = rawArgs[index + 1]

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`)
    }

    parsed[key] = value
    index += 1
  }

  return parsed
}
