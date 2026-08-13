import { readFile } from "node:fs/promises"
import path from "node:path"
import { renderPalette } from "./render/renderPalette.js"
import type { Palette } from "./types.js"

const inputPath = process.argv[2] ?? "data/sample-palette.json"
const outputPath = process.argv[3] ?? "output/palette-sample.png"

const palette = JSON.parse(
  await readFile(path.resolve(inputPath), "utf8"),
) as Palette

await renderPalette(palette, {
  outputPath: path.resolve(outputPath),
})

console.log(`Rendered ${outputPath}`)
