import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { renderPalette } from "../render/renderPalette.js"
import type { Palette } from "../types.js"

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

  await renderPalette(palette, { outputPath })
  console.log(`Rendered ${path.relative(process.cwd(), outputPath)}`)
}
