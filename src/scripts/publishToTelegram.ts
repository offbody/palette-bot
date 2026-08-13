import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import {
  getTelegramChat,
  sendTelegramMediaGroup,
  sendTelegramPhoto,
} from "../telegram/telegramClient.js"
import { loadTelegramConfig } from "../telegram/telegramConfig.js"

const args = parseArgs(process.argv.slice(2))
const photoPaths = parsePhotoPaths(args)
const messagePath = path.resolve(args.message ?? "output/post-message.txt")
const envPath = args.env ? path.resolve(args.env) : undefined
const dryRun = args["dry-run"] === "true" || args["dry-run"] === "1"

const config = await loadTelegramConfig(envPath)
const [photoStats, caption] = await Promise.all([
  Promise.all(photoPaths.map((photoPath) => stat(photoPath))),
  readFile(messagePath, "utf8"),
])
const chat = await getTelegramChat(config)

if (dryRun) {
  console.log(`Telegram dry-run target: ${formatChat(chat)}`)
  photoPaths.forEach((photoPath, index) => {
    const stats = photoStats[index]!
    console.log(
      `Telegram dry-run photo ${index + 1}: ${path.relative(process.cwd(), photoPath)} (${stats.size} bytes)`,
    )
  })
  console.log(
    `Telegram dry-run caption lines: ${caption.trimEnd().split("\n").length}`,
  )
  process.exit(0)
}

if (photoPaths.length === 1) {
  const message = await sendTelegramPhoto({
    config,
    photoPath: photoPaths[0]!,
    caption: caption.trimEnd(),
  })

  console.log(
    `Published Telegram message ${message.message_id} to ${formatChat(message.chat)}`,
  )
} else {
  const messages = await sendTelegramMediaGroup({
    config,
    photoPaths,
    caption: caption.trimEnd(),
  })

  console.log(
    `Published Telegram media group ${messages.map((message) => message.message_id).join(", ")} to ${formatChat(messages[0]!.chat)}`,
  )
}

function formatChat(chat: {
  id: number
  title?: string
  username?: string
  type: string
}) {
  const label = chat.title ?? chat.username ?? String(chat.id)
  return `${label} (${chat.type})`
}

function parseArgs(rawArgs: string[]) {
  const parsed: Record<string, string> = {}

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]

    if (arg === "--") {
      continue
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`)
    }

    const key = arg.slice(2)
    const value = rawArgs[index + 1]

    if (!value || value.startsWith("--")) {
      parsed[key] = "true"
      continue
    }

    parsed[key] = value
    index += 1
  }

  return parsed
}

function parsePhotoPaths(args: Record<string, string>) {
  const rawPhotoPaths = args.photos
    ? args.photos.split(",").map((photoPath) => photoPath.trim())
    : [args.photo ?? "output/post-palette.png"]

  if (rawPhotoPaths.some((photoPath) => photoPath.length === 0)) {
    throw new Error("Photo paths must not be empty.")
  }

  return rawPhotoPaths.map((photoPath) => path.resolve(photoPath))
}
