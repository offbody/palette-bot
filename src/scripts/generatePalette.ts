import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { generatePalette } from "../generator/generatePalette.js"

const args = parseArgs(process.argv.slice(2))
const colorCount = Number.parseInt(args.colors ?? "5", 10)
const outputPath = path.resolve(args.output ?? "output/generated-palette.json")

const palette = generatePalette({
  colorCount,
  seed: args.seed,
  paletteName: args.name,
})

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(palette, null, 2)}\n`, "utf8")

console.log(`Generated ${path.relative(process.cwd(), outputPath)}`)

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
