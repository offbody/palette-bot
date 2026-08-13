import {
  createAwwwardsPalette,
  createAwwwardsSotdMessage,
  extractAwwwardsPaletteColors,
  type AwwwardsSotdSource,
} from "../sources/awwwardsSotd.js"

const sampleText = `
Site of the Day - Aug 13, 2026
Color Palette

This website uses a color
palette of 3 colors

HEX #000
Aa
HEX #D71E1E
Aa
HEX #1e4bd7
Aa
Technologies & Tools
`

const colors = extractAwwwardsPaletteColors(sampleText)

assertEqual(colors.join(","), "#000000,#D71E1E,#1E4BD7")

const source: AwwwardsSotdSource = {
  title: "Mosby's Files",
  awardDate: "Aug 13, 2026",
  caseUrl: "https://www.awwwards.com/sites/mosbys-files",
  websiteUrl: "https://www.mosbyfiles.com/",
  screenshotUrl:
    "https://assets.awwwards.com/awards/submissions/2026/06/6a439343be70c234196985.png",
  colors,
}
const palette = createAwwwardsPalette(source)
const message = createAwwwardsSotdMessage(source, palette)

if (palette.paletteName !== source.title) {
  throw new Error(`Unexpected palette name: ${palette.paletteName}`)
}

if (palette.colors.length !== 3) {
  throw new Error(`Expected 3 colors; received ${palette.colors.length}.`)
}

if (!message.includes("<b>Mosby's Files</b>")) {
  throw new Error(`Awwwards message title is missing: ${message}`)
}

if (!message.includes("#000000") || !message.includes("#D71E1E")) {
  throw new Error(`Awwwards message colors are missing: ${message}`)
}

console.log(
  `Awwwards SOTD parser: ${palette.colors.length} colors, ${message.split("\n").length} message lines.`,
)

function assertEqual(actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}; received ${actual}.`)
  }
}
