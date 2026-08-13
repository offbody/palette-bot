import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { generatePalette } from "../generator/generatePalette.js"
import {
  parseRenderPaletteTheme,
  renderPalette,
} from "../render/renderPalette.js"

const args = parseArgs(process.argv.slice(2))
const colorCount = Number.parseInt(args.colors ?? "5", 10)
const jsonPath = path.resolve(args.json ?? "output/generated-palette.json")
const pngPath = path.resolve(args.png ?? "output/generated-palette.png")
const theme = args.theme ? parseRenderPaletteTheme(args.theme) : undefined

const palette = generatePalette({
  colorCount,
  seed: args.seed,
  paletteName: args.name,
})

await mkdir(path.dirname(jsonPath), { recursive: true })
await writeFile(jsonPath, `${JSON.stringify(palette, null, 2)}\n`, "utf8")
await renderPalette(palette, { outputPath: pngPath, theme })

console.log(`Generated ${path.relative(process.cwd(), jsonPath)}`)
console.log(`Rendered ${path.relative(process.cwd(), pngPath)}`)

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
