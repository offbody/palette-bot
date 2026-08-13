import { readFile } from "node:fs/promises"
import { chromium } from "playwright"

const DEFAULT_MAX_COLORS = 8
const DEFAULT_SAMPLE_SIZE = 160
const DEFAULT_MIN_DISTANCE = 46

export type ExtractImagePaletteOptions = {
  maxColors?: number
  sampleSize?: number
}

export type MergePaletteColorsOptions = {
  maxColors?: number
  minDistance?: number
}

export async function extractDominantColorsFromImage(
  imagePath: string,
  options: ExtractImagePaletteOptions = {},
) {
  const image = await readFile(imagePath)
  const mimeType = getImageMimeType(image)
  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage()
    return await page.evaluate(
      async ({ dataUrl, maxColors, sampleSize }) => {
        const image = await loadImage(dataUrl)
        const scale = Math.min(1, sampleSize / image.width, sampleSize / image.height)
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d", {
          willReadFrequently: true,
        })

        if (!context) {
          throw new Error("Could not create canvas context for image palette extraction.")
        }

        canvas.width = width
        canvas.height = height
        context.drawImage(image, 0, 0, width, height)

        const pixels = context.getImageData(0, 0, width, height).data
        const buckets = new Map<
          string,
          {
            count: number
            red: number
            green: number
            blue: number
          }
        >()

        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3]!

          if (alpha < 220) {
            continue
          }

          const red = pixels[index]!
          const green = pixels[index + 1]!
          const blue = pixels[index + 2]!

          const bucketRed = quantize(red)
          const bucketGreen = quantize(green)
          const bucketBlue = quantize(blue)
          const key = `${bucketRed},${bucketGreen},${bucketBlue}`
          const bucket = buckets.get(key) ?? {
            count: 0,
            red: 0,
            green: 0,
            blue: 0,
          }

          bucket.count += 1
          bucket.red += red
          bucket.green += green
          bucket.blue += blue
          buckets.set(key, bucket)
        }

        return [...buckets.values()]
          .map((bucket) => {
            const red = Math.round(bucket.red / bucket.count)
            const green = Math.round(bucket.green / bucket.count)
            const blue = Math.round(bucket.blue / bucket.count)
            const { saturation, lightness } = rgbToHsl(red, green, blue)

            return {
              hex: rgbToHex(red, green, blue),
              score:
                bucket.count *
                (0.62 + Math.min(1, saturation / 100) * 0.28) *
                getLightnessWeight(lightness),
            }
          })
          .sort((left, right) => right.score - left.score)
          .slice(0, maxColors * 6)
          .map((color) => color.hex)
          .filter((hex, index, colors) => colors.indexOf(hex) === index)
          .slice(0, maxColors)

        function quantize(value: number) {
          return Math.min(255, Math.max(0, Math.round(value / 16) * 16))
        }

        function loadImage(src: string) {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error("Could not load image for palette extraction."))
            image.src = src
          })
        }

        function rgbToHex(red: number, green: number, blue: number) {
          return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
        }

        function toHex(value: number) {
          return value.toString(16).padStart(2, "0").toUpperCase()
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

          return {
            saturation,
            lightness,
          }
        }

        function getLightnessWeight(lightness: number) {
          if (lightness < 4 || lightness > 98) {
            return 0.42
          }

          if (lightness < 9 || lightness > 94) {
            return 0.68
          }

          return 1
        }
      },
      {
        dataUrl,
        maxColors: options.maxColors ?? DEFAULT_MAX_COLORS,
        sampleSize: options.sampleSize ?? DEFAULT_SAMPLE_SIZE,
      },
    )
  } finally {
    await browser.close()
  }
}

export function mergePaletteColors(
  baseColors: string[],
  candidateColors: string[],
  options: MergePaletteColorsOptions = {},
) {
  const maxColors = options.maxColors ?? 5
  const minDistance = options.minDistance ?? DEFAULT_MIN_DISTANCE
  const merged: string[] = []

  for (const color of [...baseColors, ...candidateColors]) {
    const normalized = normalizeHexColor(color)

    if (!normalized) {
      continue
    }

    if (merged.some((existingColor) => colorDistance(existingColor, normalized) < minDistance)) {
      continue
    }

    merged.push(normalized)

    if (merged.length >= maxColors) {
      break
    }
  }

  return merged
}

function getImageMimeType(image: Buffer) {
  if (
    image[0] === 0x89 &&
    image[1] === 0x50 &&
    image[2] === 0x4e &&
    image[3] === 0x47
  ) {
    return "image/png"
  }

  if (image[0] === 0xff && image[1] === 0xd8) {
    return "image/jpeg"
  }

  if (
    image[0] === 0x47 &&
    image[1] === 0x49 &&
    image[2] === 0x46 &&
    image[3] === 0x38
  ) {
    return "image/gif"
  }

  return "image/png"
}

function colorDistance(leftHex: string, rightHex: string) {
  const left = hexToRgb(leftHex)
  const right = hexToRgb(rightHex)

  return Math.sqrt(
    (left.red - right.red) ** 2 +
      (left.green - right.green) ** 2 +
      (left.blue - right.blue) ** 2,
  )
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

function hexToRgb(hex: string) {
  const normalized = hex.slice(1)
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  }
}
