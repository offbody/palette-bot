import { readFile } from "node:fs/promises"
import path from "node:path"

const messagePath = path.resolve(
  process.argv.find((arg, index) => index >= 2 && arg !== "--") ??
    "output/post-message.txt",
)
const message = await readFile(messagePath, "utf8")
const lines = message.trimEnd().split("\n")

if (lines.length < 3 || lines.length > 7) {
  throw new Error(`Expected 3 to 7 message lines; received ${lines.length}.`)
}

if (!/^<b>[^<>\n]+<\/b>$/.test(lines[0]!)) {
  throw new Error(`Invalid palette message title: ${lines[0]}`)
}

if (lines[1] !== "") {
  throw new Error("Expected a blank line after the palette message title.")
}

for (const line of lines.slice(2)) {
  if (!/^[^\n#]+ #[0-9A-F]{6}$/.test(line)) {
    throw new Error(`Invalid palette message line: ${line}`)
  }
}

console.log(
  `${path.relative(process.cwd(), messagePath)}: ${lines.length} lines`,
)
