import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { renderPalette, parseRenderPaletteTheme } from "../render/renderPalette.js"
import {
  createAwwwardsPalette,
  createAwwwardsSotdMessage,
  downloadAwwwardsScreenshot,
  fetchAwwwardsSotd,
} from "../sources/awwwardsSotd.js"

const args = parseArgs(process.argv.slice(2))
const sourcePath = path.resolve(args.source ?? "output/awwwards-sotd-source.json")
const screenshotPath = path.resolve(
  args.screenshot ?? "output/awwwards-sotd-screenshot.png",
)
const paletteJsonPath = path.resolve(
  args["palette-json"] ?? "output/awwwards-sotd-palette.json",
)
const palettePngPath = path.resolve(
  args["palette-png"] ?? "output/awwwards-sotd-palette.png",
)
const messagePath = path.resolve(
  args.message ?? "output/awwwards-sotd-message.txt",
)
const rendererTheme = args.theme ? parseRenderPaletteTheme(args.theme) : "figma"

const source = await fetchAwwwardsSotd({
  listingUrl: args["listing-url"],
  caseUrl: args["case-url"],
})
const palette = createAwwwardsPalette(source)
const message = createAwwwardsSotdMessage(source, palette)

await Promise.all([
  mkdir(path.dirname(sourcePath), { recursive: true }),
  mkdir(path.dirname(screenshotPath), { recursive: true }),
  mkdir(path.dirname(paletteJsonPath), { recursive: true }),
  mkdir(path.dirname(palettePngPath), { recursive: true }),
  mkdir(path.dirname(messagePath), { recursive: true }),
])

await Promise.all([
  writeFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`, "utf8"),
  writeFile(paletteJsonPath, `${JSON.stringify(palette, null, 2)}\n`, "utf8"),
  writeFile(messagePath, `${message}\n`, "utf8"),
  downloadAwwwardsScreenshot(source, screenshotPath),
  renderPalette(palette, {
    outputPath: palettePngPath,
    theme: rendererTheme,
  }),
])

console.log(`Fetched ${source.title}`)
console.log(`Source ${path.relative(process.cwd(), sourcePath)}`)
console.log(`Screenshot ${path.relative(process.cwd(), screenshotPath)}`)
console.log(`Palette JSON ${path.relative(process.cwd(), paletteJsonPath)}`)
console.log(`Palette PNG ${path.relative(process.cwd(), palettePngPath)}`)
console.log(`Message ${path.relative(process.cwd(), messagePath)}`)

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
      parsed[key] = "true"
      continue
    }

    parsed[key] = value
    index += 1
  }

  return parsed
}
