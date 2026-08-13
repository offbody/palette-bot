import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"
import type { Page } from "playwright"
import type { Palette, PaletteColor } from "../types.js"

const DEFAULT_LISTING_URL =
  "https://www.awwwards.com/websites/sites_of_the_day/"
const MAX_RENDERED_COLORS = 5
const HEX_PATTERN = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g

export type AwwwardsSotdSource = {
  title: string
  awardDate?: string
  caseType: "site_of_the_day" | "nominee"
  caseUrl: string
  websiteUrl?: string
  screenshotUrl: string
  colors: string[]
}

export type FetchAwwwardsSotdOptions = {
  listingUrl?: string
  caseUrl?: string
}

export async function fetchAwwwardsSotd(
  options: FetchAwwwardsSotdOptions = {},
): Promise<AwwwardsSotdSource> {
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 1153,
      },
    })

    const caseUrl =
      options.caseUrl ??
      (await resolveLatestSotdCaseUrl(
        page,
        options.listingUrl ?? DEFAULT_LISTING_URL,
      ))

    await page.goto(caseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    })
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
      // Awwwards pages can keep analytics or video requests alive; the DOM is enough.
    })

    const source = await page.evaluate((resolvedCaseUrl) => {
      const bodyText = document.body.innerText
      const title =
        document.querySelector("h1")?.textContent?.trim() ??
        document.title.replace(/\s+-\s+Awwwards.*$/i, "").trim()
      const paletteText = extractSectionText(bodyText, "Color Palette", [
        "Technologies & Tools",
        "Description",
        "Inside look",
        "SOTD / SCORE",
      ])
      const paletteColors = extractHexColors(paletteText)

      const screenshotUrl = [...document.querySelectorAll("img")]
        .map((image) => ({
          alt: image.alt,
          src: image.currentSrc || image.src,
          width: image.naturalWidth,
          height: image.naturalHeight,
        }))
        .filter(
          (image) =>
            image.src.startsWith("https://") &&
            image.width >= 800 &&
            image.height >= 500,
        )
        .sort((left, right) => {
          const leftIsSubmission = left.src.includes("/awards/submissions/")
          const rightIsSubmission = right.src.includes("/awards/submissions/")

          if (leftIsSubmission !== rightIsSubmission) {
            return leftIsSubmission ? -1 : 1
          }

          return right.width * right.height - left.width * left.height
        })[0]?.src

      const websiteUrl = [...document.querySelectorAll("a[href]")]
        .map((anchor) => (anchor as HTMLAnchorElement).href)
        .find((href) => isLikelyProjectUrl(href))

      return {
        title,
        awardDate: bodyText.match(/Site of the Day\s*-\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4})/)?.[1],
        caseType: paletteColors.length > 0 ? "site_of_the_day" : "nominee",
        caseUrl: resolvedCaseUrl,
        websiteUrl,
        screenshotUrl,
        colors: [...new Set(paletteColors)],
      }

      function extractSectionText(
        text: string,
        startLabel: string,
        endLabels: string[],
      ) {
        const start = text.indexOf(startLabel)

        if (start < 0) {
          return ""
        }

        const end = endLabels
          .map((label) => text.indexOf(label, start + startLabel.length))
          .filter((index) => index > start)
          .sort((left, right) => left - right)[0]

        return text.slice(start, end ?? start + 1000)
      }

      function extractHexColors(text: string) {
        return [...text.matchAll(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)].map(
          (match) => match[0],
        )
      }

      function isLikelyProjectUrl(href: string) {
        const url = new URL(href)
        const hostname = url.hostname.replace(/^www\./, "")
        const blockedHostnames = new Set([
          "awwwards.com",
          "facebook.com",
          "instagram.com",
          "linkedin.com",
          "twitter.com",
          "x.com",
          "youtube.com",
          "tiktok.com",
        ])

        return (
          url.protocol.startsWith("http") &&
          !blockedHostnames.has(hostname) &&
          !hostname.endsWith(".awwwards.com")
        )
      }
    }, caseUrl)

    return validateAwwwardsSotdSource({
      ...source,
      caseType:
        source.caseType === "site_of_the_day" ? "site_of_the_day" : "nominee",
      colors: normalizeHexColors(source.colors).slice(0, MAX_RENDERED_COLORS),
    })
  } finally {
    await browser.close()
  }
}

export async function downloadAwwwardsScreenshot(
  source: AwwwardsSotdSource,
  outputPath: string,
) {
  const response = await fetch(source.screenshotUrl, {
    headers: {
      "user-agent": "palette-bot/0.1 (+https://github.com/offbody/palette-bot)",
    },
  })

  if (!response.ok) {
    throw new Error(
      `Could not download Awwwards screenshot: ${response.status} ${response.statusText}`,
    )
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
}

export function createAwwwardsPalette(source: AwwwardsSotdSource): Palette {
  const usedNames = new Map<string, number>()

  return {
    paletteName: source.title,
    colors: source.colors.map((hex) => ({
      name: createUniqueColorName(nameColorFromHex(hex), usedNames),
      hex,
    })),
    metadata: undefined,
  }
}

export function createAwwwardsSotdMessage(
  source: AwwwardsSotdSource,
  palette: Palette,
) {
  const lines = [
    `<b>${escapeHtml(normalizeWhitespace(source.title))}</b>`,
    source.caseType === "site_of_the_day"
      ? "Awwwards Site of the Day"
      : "Awwwards Nominee",
  ]

  if (source.awardDate) {
    lines.push(escapeHtml(source.awardDate))
  }

  lines.push("")
  lines.push(...palette.colors.map(formatColorLine))
  lines.push("")
  lines.push(`Source: ${formatLink(source.caseUrl, "Awwwards")}`)

  if (source.websiteUrl) {
    lines.push(`Website: ${formatLink(source.websiteUrl, "Visit site")}`)
  }

  return lines.join("\n")
}

export function extractAwwwardsPaletteColors(text: string) {
  const paletteText = extractAwwwardsPaletteText(text)
  return normalizeHexColors([...paletteText.matchAll(HEX_PATTERN)].map((m) => m[0]))
}

async function resolveLatestSotdCaseUrl(page: Page, listingUrl: string) {
  await page.goto(listingUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  })
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
    // The listing can keep non-critical requests alive.
  })

  const caseUrl = await page.evaluate(() => {
    return [...document.querySelectorAll("a[href*='/sites/']")]
      .map((anchor) => (anchor as HTMLAnchorElement).href)
      .find((href) => /^https:\/\/www\.awwwards\.com\/sites\/[^/]+\/?$/.test(href))
  })

  if (!caseUrl) {
    throw new Error("Could not find the latest Awwwards Site of the Day URL.")
  }

  return caseUrl
}

function validateAwwwardsSotdSource(source: Partial<AwwwardsSotdSource>) {
  if (!source.title) {
    throw new Error("Awwwards SOTD title is missing.")
  }

  if (!source.caseUrl) {
    throw new Error("Awwwards SOTD case URL is missing.")
  }

  if (!source.screenshotUrl) {
    throw new Error("Awwwards SOTD screenshot URL is missing.")
  }

  return source as AwwwardsSotdSource
}

function extractAwwwardsPaletteText(text: string) {
  const start = text.indexOf("Color Palette")

  if (start < 0) {
    return ""
  }

  const end = [
    "Technologies & Tools",
    "Description",
    "Inside look",
    "SOTD / SCORE",
  ]
    .map((label) => text.indexOf(label, start + "Color Palette".length))
    .filter((index) => index > start)
    .sort((left, right) => left - right)[0]

  return text.slice(start, end ?? start + 1000)
}

function normalizeHexColors(colors: string[]) {
  return [
    ...new Set(
      colors
        .map(normalizeHexColor)
        .filter((color): color is string => color !== undefined),
    ),
  ]
}

function normalizeHexColor(value: string) {
  const normalized = value.trim().toUpperCase()

  if (!/^#[0-9A-F]{3}$|^#[0-9A-F]{6}$/.test(normalized)) {
    return undefined
  }

  if (normalized.length === 4) {
    const [, red, green, blue] = normalized
    return `#${red}${red}${green}${green}${blue}${blue}`
  }

  return normalized
}

function formatColorLine(color: PaletteColor) {
  return `${escapeHtml(normalizeWhitespace(color.name))} ${color.hex.toUpperCase()}`
}

function formatLink(url: string, label: string) {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`
}

function createUniqueColorName(name: string, usedNames: Map<string, number>) {
  const count = usedNames.get(name) ?? 0
  usedNames.set(name, count + 1)
  return count === 0 ? name : `${name} ${count + 1}`
}

function nameColorFromHex(hex: string) {
  const { red, green, blue } = hexToRgb(hex)
  const { hue, saturation, lightness } = rgbToHsl(red, green, blue)

  if (lightness < 8) {
    return "Black"
  }

  if (lightness > 94 && saturation < 12) {
    return "White"
  }

  if (saturation < 10) {
    if (lightness < 25) return "Ink"
    if (lightness < 45) return "Slate"
    if (lightness < 70) return "Gray"
    return "Mist"
  }

  const baseName = getHueName(hue)

  if (lightness < 22) {
    return `Dark ${baseName}`
  }

  if (lightness > 82) {
    return `Pale ${baseName}`
  }

  if (saturation < 35) {
    return `Muted ${baseName}`
  }

  if (saturation > 78 && lightness > 48) {
    return `Bright ${baseName}`
  }

  return baseName
}

function getHueName(hue: number) {
  if (hue < 12 || hue >= 350) return "Red"
  if (hue < 32) return "Orange"
  if (hue < 48) return "Amber"
  if (hue < 65) return "Yellow"
  if (hue < 95) return "Lime"
  if (hue < 150) return "Green"
  if (hue < 175) return "Mint"
  if (hue < 200) return "Cyan"
  if (hue < 235) return "Blue"
  if (hue < 260) return "Indigo"
  if (hue < 285) return "Violet"
  if (hue < 315) return "Purple"
  if (hue < 335) return "Magenta"
  return "Rose"
}

function hexToRgb(hex: string) {
  const normalized = hex.slice(1)
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = ((max + min) / 2) * 100
  const saturation =
    delta === 0
      ? 0
      : (delta / (1 - Math.abs(2 * ((max + min) / 2) - 1))) * 100

  let hue = 0

  if (delta !== 0) {
    if (max === r) {
      hue = 60 * (((g - b) / delta) % 6)
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2)
    } else {
      hue = 60 * ((r - g) / delta + 4)
    }
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation,
    lightness,
  }
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
