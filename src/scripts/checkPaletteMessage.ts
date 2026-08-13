import { readFile } from "node:fs/promises"
import path from "node:path"

const messagePath = path.resolve(
  process.argv.find((arg, index) => index >= 2 && arg !== "--") ??
    "output/post-message.txt",
)
const message = await readFile(messagePath, "utf8")
const lines = message.trimEnd().split("\n")

if (lines.length < 1 || lines.length > 5) {
  throw new Error(`Expected 1 to 5 message lines; received ${lines.length}.`)
}

for (const line of lines) {
  if (!/^[^\n#]+ #[0-9A-F]{6}$/.test(line)) {
    throw new Error(`Invalid palette message line: ${line}`)
  }
}

console.log(`${path.relative(process.cwd(), messagePath)}: ${lines.length} lines`)
