import { readFile } from "node:fs/promises"
import path from "node:path"
import type { TelegramConfig } from "./telegramConfig.js"

type TelegramApiResponse<T> =
  | {
      ok: true
      result: T
    }
  | {
      ok: false
      description?: string
    }

export type TelegramChat = {
  id: number
  title?: string
  username?: string
  type: string
}

export type TelegramMessage = {
  message_id: number
  chat: TelegramChat
}

export async function getTelegramChat(config: TelegramConfig) {
  const formData = new FormData()
  formData.set("chat_id", config.chatId)

  return callTelegramApi<TelegramChat>(config, "getChat", formData)
}

export async function sendTelegramPhoto(options: {
  config: TelegramConfig
  photoPath: string
  caption: string
}) {
  const formData = new FormData()
  const photo = await readFile(options.photoPath)

  formData.set("chat_id", options.config.chatId)
  formData.set("caption", options.caption)
  formData.set("parse_mode", "HTML")
  formData.set("photo", new Blob([photo]), path.basename(options.photoPath))

  return callTelegramApi<TelegramMessage>(
    options.config,
    "sendPhoto",
    formData,
  )
}

async function callTelegramApi<T>(
  config: TelegramConfig,
  method: string,
  body: FormData,
) {
  const response = await fetch(
    `https://api.telegram.org/bot${config.botToken}/${method}`,
    {
      method: "POST",
      body,
    },
  )
  const payload = (await response.json()) as TelegramApiResponse<T>

  if (!payload.ok) {
    throw new Error(
      `Telegram ${method} failed: ${payload.description ?? response.statusText}`,
    )
  }

  return payload.result
}
