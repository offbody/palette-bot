import {
  generatePalette,
  paletteHarmonies,
  palettePresets,
} from "../generator/generatePalette.js"

const hexPattern = /^#[0-9A-F]{6}$/

for (let colorCount = 1; colorCount <= 5; colorCount += 1) {
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

  assertMetadata(firstPalette, colorCount)
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

for (const preset of palettePresets) {
  const palette = generatePalette({
    colorCount: 5,
    seed: `ci-${preset}`,
    preset,
    candidates: 8,
  })

  assertMetadata(palette, 5)

  if (palette.metadata?.preset !== preset) {
    throw new Error(`Expected preset ${preset}; received ${palette.metadata?.preset}.`)
  }

  console.log(`${preset}: score ${palette.metadata.score}`)
}

for (const harmony of paletteHarmonies) {
  const palette = generatePalette({
    colorCount: 5,
    seed: `ci-${harmony}`,
    harmony,
    candidates: 8,
  })

  assertMetadata(palette, 5)

  if (palette.metadata?.harmony !== harmony) {
    throw new Error(
      `Expected harmony ${harmony}; received ${palette.metadata?.harmony}.`,
    )
  }

  console.log(`${harmony}: score ${palette.metadata.score}`)
}

const samplePaletteNames = new Set<string>()
const sampleColorNames = new Set<string>()

for (let index = 0; index < 40; index += 1) {
  const palette = generatePalette({
    colorCount: 5,
    seed: `ci-diversity-${index}`,
    candidates: 12,
  })

  samplePaletteNames.add(palette.paletteName)

  for (const color of palette.colors) {
    sampleColorNames.add(color.name)
  }
}

if (samplePaletteNames.size < 34) {
  throw new Error(
    `Expected at least 34 unique palette names; received ${samplePaletteNames.size}.`,
  )
}

if (sampleColorNames.size < 70) {
  throw new Error(
    `Expected at least 70 unique color names; received ${sampleColorNames.size}.`,
  )
}

function assertMetadata(
  palette: ReturnType<typeof generatePalette>,
  colorCount: number,
) {
  if (!palette.metadata) {
    throw new Error("Generated palette metadata is missing.")
  }

  if (palette.metadata.colorCount !== colorCount) {
    throw new Error(
      `Metadata color count ${palette.metadata.colorCount}; expected ${colorCount}.`,
    )
  }

  if (palette.metadata.score < 1 || palette.metadata.score > 100) {
    throw new Error(`Generated invalid score: ${palette.metadata.score}`)
  }

  if (palette.metadata.selectedCandidate > palette.metadata.candidateCount) {
    throw new Error("Selected candidate exceeds candidate count.")
  }
}
