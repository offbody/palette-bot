import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const EXPECTED_WIDTH = 1440
const EXPECTED_HEIGHT = 1153
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const outputDir = path.resolve("output/fixtures")

const pngFiles = (await readdir(outputDir))
  .filter((fileName) => fileName.endsWith(".png"))
  .sort()

if (pngFiles.length === 0) {
  throw new Error(`No rendered PNG files found in ${outputDir}`)
}

for (const pngFile of pngFiles) {
  const filePath = path.join(outputDir, pngFile)
  const fileBuffer = await readFile(filePath)

  if (!fileBuffer.subarray(0, 4).equals(pngSignature)) {
    throw new Error(`${pngFile} is not a PNG file.`)
  }

  const width = fileBuffer.readUInt32BE(16)
  const height = fileBuffer.readUInt32BE(20)

  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    throw new Error(
      `${pngFile} is ${width} x ${height}; expected ${EXPECTED_WIDTH} x ${EXPECTED_HEIGHT}.`,
    )
  }

  console.log(`${pngFile}: ${width} x ${height}`)
}
