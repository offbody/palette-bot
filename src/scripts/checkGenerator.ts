import { generatePalette } from "../generator/generatePalette.js"

const hexPattern = /^#[0-9A-F]{6}$/

for (let colorCount = 2; colorCount <= 7; colorCount += 1) {
  const firstPalette = generatePalette({
    colorCount,
    seed: "ci-smoke",
  })
  const secondPalette = generatePalette({
    colorCount,
    seed: "ci-smoke",
  })

  if (JSON.stringify(firstPalette) !== JSON.stringify(secondPalette)) {
    throw new Error(`Generator is not deterministic for ${colorCount} colors.`)
  }

  if (firstPalette.colors.length !== colorCount) {
    throw new Error(
      `Generated ${firstPalette.colors.length} colors; expected ${colorCount}.`,
    )
  }

  const colorNames = new Set<string>()

  for (const color of firstPalette.colors) {
    if (!color.name.trim()) {
      throw new Error("Generated color name is empty.")
    }

    if (colorNames.has(color.name)) {
      throw new Error(`Generated duplicate color name: ${color.name}`)
    }

    colorNames.add(color.name)

    if (!hexPattern.test(color.hex)) {
      throw new Error(`Generated invalid hex color: ${color.hex}`)
    }
  }

  console.log(`${colorCount} colors: ${firstPalette.paletteName}`)
}
