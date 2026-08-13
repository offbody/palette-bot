import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

const EXPECTED_WIDTH = 1440
const EXPECTED_HEIGHT = 1153
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const targets = process.argv.slice(2).filter((arg) => arg !== "--")
const targetPaths = targets.length > 0 ? targets : ["output/fixtures"]

const pngFiles = (
  await Promise.all(targetPaths.map((targetPath) => resolvePngFiles(targetPath)))
)
  .flat()
  .sort()

if (pngFiles.length === 0) {
  throw new Error(`No PNG files found in ${targetPaths.join(", ")}`)
}

for (const pngFile of pngFiles) {
  const fileBuffer = await readFile(pngFile)

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

  console.log(`${path.relative(process.cwd(), pngFile)}: ${width} x ${height}`)
}

async function resolvePngFiles(targetPath: string) {
  const resolvedPath = path.resolve(targetPath)
  const targetStat = await stat(resolvedPath)

  if (targetStat.isDirectory()) {
    const entries = await readdir(resolvedPath)
    return entries
      .filter((entry) => entry.endsWith(".png"))
      .map((entry) => path.join(resolvedPath, entry))
  }

  return [resolvedPath]
}
