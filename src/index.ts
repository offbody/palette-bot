import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  parseRenderPaletteTheme,
  renderPalette,
} from "./render/renderPalette.js"
import type { Palette } from "./types.js"

const args = parseArgs(process.argv.slice(2))
const inputPath = args.positionals[0] ?? "data/sample-palette.json"
const outputPath = args.positionals[1] ?? "output/palette-sample.png"
const theme = args.options.theme
  ? parseRenderPaletteTheme(args.options.theme)
  : undefined

const palette = JSON.parse(
  await readFile(path.resolve(inputPath), "utf8"),
) as Palette

await renderPalette(palette, {
  outputPath: path.resolve(outputPath),
  theme,
})

console.log(`Rendered ${outputPath}`)

function parseArgs(rawArgs: string[]) {
  const positionals: string[] = []
  const options: Record<string, string> = {}

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]

    if (arg === "--") {
      continue
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg)
      continue
    }

    const key = arg.slice(2)
    const value = rawArgs[index + 1]

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`)
    }

    options[key] = value
    index += 1
  }

  return { options, positionals }
}
