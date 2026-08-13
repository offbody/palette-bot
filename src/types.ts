export type PaletteColor = {
  name: string
  hex: string
}

export type PaletteHarmony =
  | "analogous"
  | "complementary"
  | "triadic"
  | "monochrome"
  | "warm"
  | "cool"
  | "muted"
  | "vivid"

export type PalettePreset =
  | "ui-soft"
  | "editorial-bold"
  | "minimal-neutral"
  | "brand-vivid"
  | "dark-interface"

export type PaletteScoreBreakdown = {
  contrast: number
  separation: number
  harmony: number
  lightness: number
  usability: number
}

export type PaletteMetadata = {
  seed: string
  generatedAt: string
  colorCount: number
  preset: PalettePreset
  harmony: PaletteHarmony
  candidateCount: number
  selectedCandidate: number
  score: number
  scoreBreakdown: PaletteScoreBreakdown
}

export type PalettePublicationPlan = {
  date: string
  seed: string
  strategyAttempt: number
  colorCount: number
  preset: PalettePreset
  harmony: PaletteHarmony
  candidates: number
  rendererTheme: "technical" | "figma"
}

export type Palette = {
  paletteName: string
  colors: PaletteColor[]
  metadata?: PaletteMetadata
}
