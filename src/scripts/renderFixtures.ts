import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import {
  parseRenderPaletteTheme,
  renderPalette,
} from "../render/renderPalette.js"
import type { Palette } from "../types.js"

const args = parseArgs(process.argv.slice(2))
const theme = args.theme ? parseRenderPaletteTheme(args.theme) : undefined
const fixturesDir = path.resolve("data/fixtures")
const outputDir = path.resolve("output/fixtures")

const fixtureFiles = (await readdir(fixturesDir))
  .filter((fileName) => fileName.endsWith(".json"))
  .sort()

if (fixtureFiles.length === 0) {
  throw new Error(`No fixture palettes found in ${fixturesDir}`)
}

for (const fixtureFile of fixtureFiles) {
  const inputPath = path.join(fixturesDir, fixtureFile)
  const outputPath = path.join(
    outputDir,
    `${path.basename(fixtureFile, ".json")}.png`,
  )
  const palette = JSON.parse(await readFile(inputPath, "utf8")) as Palette

  await renderPalette(palette, { outputPath, theme })
  console.log(`Rendered ${path.relative(process.cwd(), outputPath)}`)
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
