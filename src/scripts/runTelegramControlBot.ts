import { readFile } from "node:fs/promises"
import path from "node:path"
import { getPaletteHarmoniesForPreset } from "../generator/generatePalette.js"
import {
  dispatchWorkflow,
  upsertRepositoryVariable,
} from "../github/githubActionsClient.js"
import type { PaletteHarmony, PalettePreset } from "../types.js"

type ControlBotConfig = {
  botToken: string
  adminUserIds: Set<number>
  githubToken: string
  githubRepository: string
  githubWorkflowId: string
  githubAwwwardsWorkflowId: string
  githubRef: string
}

type PublishDraft = {
  dryRun: boolean
  attempts: number
  minScore: number
  colorCount: ColorCountChoice
  preset: PresetChoice
  harmony: HarmonyChoice
}

type ScheduleDraft = {
  postsPerDay: number
  dayInterval: number
}

type AwwwardsDraft = {
  dryRun: boolean
  caseUrl: string
  listingUrl: string
  enrichFromScreenshot: boolean
  maxColors: AwwwardsMaxColorsChoice
}

type PendingInput = {
  type: "awwwards_case_url" | "awwwards_listing_url"
}

type MenuView =
  | "source"
  | "main"
  | "quality"
  | "color_count"
  | "preset"
  | "harmony"
  | "schedule"
  | "awwwards"

type ActionResult = {
  notice?: string
  view: MenuView
}

type ColorCountChoice = "auto" | "1" | "2" | "3" | "4" | "5"

type PresetChoice = "auto" | PalettePreset

type HarmonyChoice = "auto" | PaletteHarmony

type AwwwardsMaxColorsChoice = "1" | "2" | "3" | "4" | "5"

type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    text?: string
    chat: {
      id: number
    }
    from?: {
      id: number
    }
  }
  callback_query?: {
    id: string
    data?: string
    from: {
      id: number
    }
    message?: {
      message_id: number
      chat: {
        id: number
      }
    }
  }
}

type TelegramApiResponse<T> =
  | {
      ok: true
      result: T
    }
  | {
      ok: false
      description?: string
    }

const presetChoices = [
  "auto",
  "ui-soft",
  "editorial-bold",
  "minimal-neutral",
  "brand-vivid",
  "dark-interface",
] as const satisfies readonly PresetChoice[]

const harmonyChoices = [
  "auto",
  "analogous",
  "complementary",
  "triadic",
  "monochrome",
  "warm",
  "cool",
  "muted",
  "vivid",
] as const satisfies readonly HarmonyChoice[]

const colorCountChoices = [
  "auto",
  "1",
  "2",
  "3",
  "4",
  "5",
] as const satisfies readonly ColorCountChoice[]

const awwwardsMaxColorsChoices = [
  "1",
  "2",
  "3",
  "4",
  "5",
] as const satisfies readonly AwwwardsMaxColorsChoice[]

const args = parseArgs(process.argv.slice(2))
const envPath = path.resolve(args.env ?? ".secrets/control.env")
const config = await loadControlBotConfig(envPath)
const drafts = new Map<number, PublishDraft>()
const scheduleDrafts = new Map<number, ScheduleDraft>()
const awwwardsDrafts = new Map<number, AwwwardsDraft>()
const pendingInputs = new Map<number, PendingInput>()

let offset = 0
console.log("Telegram control bot started.")

while (true) {
  const updates = await getUpdates(config.botToken, offset)

  for (const update of updates) {
    offset = update.update_id + 1

    try {
      await handleUpdate(
        config,
        drafts,
        scheduleDrafts,
        awwwardsDrafts,
        pendingInputs,
        update,
      )
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Update failed.")
    }
  }
}

async function handleUpdate(
  config: ControlBotConfig,
  drafts: Map<number, PublishDraft>,
  scheduleDrafts: Map<number, ScheduleDraft>,
  awwwardsDrafts: Map<number, AwwwardsDraft>,
  pendingInputs: Map<number, PendingInput>,
  update: TelegramUpdate,
) {
  if (update.message) {
    await handleMessage(
      config,
      drafts,
      scheduleDrafts,
      awwwardsDrafts,
      pendingInputs,
      update.message,
    )
    return
  }

  if (update.callback_query) {
    await handleCallbackQuery(
      config,
      drafts,
      scheduleDrafts,
      awwwardsDrafts,
      pendingInputs,
      update.callback_query,
    )
  }
}

async function handleMessage(
  config: ControlBotConfig,
  drafts: Map<number, PublishDraft>,
  scheduleDrafts: Map<number, ScheduleDraft>,
  awwwardsDrafts: Map<number, AwwwardsDraft>,
  pendingInputs: Map<number, PendingInput>,
  message: NonNullable<TelegramUpdate["message"]>,
) {
  const userId = message.from?.id

  if (userId === undefined || !isAdmin(config, userId)) {
    await sendMessage(config.botToken, {
      chatId: message.chat.id,
      text: `Access denied.${userId === undefined ? "" : ` Your user id: ${userId}`}`,
    })
    return
  }

  const pendingInput = pendingInputs.get(userId)

  if (pendingInput) {
    const awwwardsDraft = getAwwwardsDraft(awwwardsDrafts, userId)
    let notice: string

    try {
      notice = applyPendingInput(awwwardsDraft, pendingInput, message.text ?? "")
      pendingInputs.delete(userId)
    } catch (error) {
      notice = error instanceof Error ? error.message : "Could not save URL."
    }

    await sendPublishMenu(
      config.botToken,
      message.chat.id,
      getDraft(drafts, userId),
      getScheduleDraft(scheduleDrafts, userId),
      awwwardsDraft,
      "awwwards",
      notice,
    )
    return
  }

  if (message.text === "/start" || message.text === "/publish") {
    const draft = getDraft(drafts, userId)
    const scheduleDraft = getScheduleDraft(scheduleDrafts, userId)
    const awwwardsDraft = getAwwwardsDraft(awwwardsDrafts, userId)
    await sendPublishMenu(
      config.botToken,
      message.chat.id,
      draft,
      scheduleDraft,
      awwwardsDraft,
      "source",
    )
    return
  }

  if (message.text === "/awwwards") {
    const draft = getDraft(drafts, userId)
    const scheduleDraft = getScheduleDraft(scheduleDrafts, userId)
    const awwwardsDraft = getAwwwardsDraft(awwwardsDrafts, userId)
    await sendPublishMenu(
      config.botToken,
      message.chat.id,
      draft,
      scheduleDraft,
      awwwardsDraft,
      "awwwards",
    )
    return
  }

  if (message.text === "/schedule") {
    const draft = getDraft(drafts, userId)
    const scheduleDraft = getScheduleDraft(scheduleDrafts, userId)
    const awwwardsDraft = getAwwwardsDraft(awwwardsDrafts, userId)
    await sendPublishMenu(
      config.botToken,
      message.chat.id,
      draft,
      scheduleDraft,
      awwwardsDraft,
      "schedule",
    )
    return
  }

  await sendMessage(config.botToken, {
    chatId: message.chat.id,
    text: "Use /publish to open publishing controls, /awwwards for Awwwards controls, or /schedule for Basic Palette scheduled settings.",
  })
}

async function handleCallbackQuery(
  config: ControlBotConfig,
  drafts: Map<number, PublishDraft>,
  scheduleDrafts: Map<number, ScheduleDraft>,
  awwwardsDrafts: Map<number, AwwwardsDraft>,
  pendingInputs: Map<number, PendingInput>,
  callbackQuery: NonNullable<TelegramUpdate["callback_query"]>,
) {
  const message = callbackQuery.message

  if (!message) {
    await answerCallbackQuery(config.botToken, callbackQuery.id)
    return
  }

  if (!isAdmin(config, callbackQuery.from.id)) {
    await answerCallbackQuery(config.botToken, callbackQuery.id, "Access denied.")
    return
  }

  const draft = getDraft(drafts, callbackQuery.from.id)
  const scheduleDraft = getScheduleDraft(scheduleDrafts, callbackQuery.from.id)
  const awwwardsDraft = getAwwwardsDraft(awwwardsDrafts, callbackQuery.from.id)
  const data = callbackQuery.data ?? ""
  let view: MenuView = "source"
  let messageNotice: string | undefined

  try {
    const result = await applyAction(
      config,
      draft,
      scheduleDraft,
      awwwardsDraft,
      pendingInputs,
      callbackQuery.from.id,
      data,
    )
    view = result.view
    messageNotice = result.notice
    await answerCallbackQuery(config.botToken, callbackQuery.id, result.notice)
  } catch (error) {
    await answerCallbackQuery(
      config.botToken,
      callbackQuery.id,
      error instanceof Error ? error.message : "Action failed.",
    )
  }

  await editPublishMenu(
    config.botToken,
    message.chat.id,
    message.message_id,
    draft,
    scheduleDraft,
    awwwardsDraft,
    view,
    messageNotice,
  )
}

async function applyAction(
  config: ControlBotConfig,
  draft: PublishDraft,
  scheduleDraft: ScheduleDraft,
  awwwardsDraft: AwwwardsDraft,
  pendingInputs: Map<number, PendingInput>,
  userId: number,
  data: string,
): Promise<ActionResult> {
  if (data === "noop") {
    return { view: "source" }
  }

  if (data.startsWith("view:")) {
    return { view: parseMenuView(data.slice("view:".length)) }
  }

  if (data === "toggle:dry_run") {
    draft.dryRun = !draft.dryRun
    return { view: "main" }
  }

  if (data === "awwwards:toggle:dry_run") {
    awwwardsDraft.dryRun = !awwwardsDraft.dryRun
    return { view: "awwwards" }
  }

  if (data === "awwwards:toggle:enrich") {
    awwwardsDraft.enrichFromScreenshot = !awwwardsDraft.enrichFromScreenshot
    return { view: "awwwards" }
  }

  if (data.startsWith("awwwards:max_colors:")) {
    awwwardsDraft.maxColors = parseAwwwardsMaxColorsChoice(
      data.slice("awwwards:max_colors:".length),
    )
    return { view: "awwwards" }
  }

  if (data === "awwwards:set_case_url") {
    pendingInputs.set(userId, { type: "awwwards_case_url" })
    return {
      notice: "Send the Awwwards case URL in the next message.",
      view: "awwwards",
    }
  }

  if (data === "awwwards:set_listing_url") {
    pendingInputs.set(userId, { type: "awwwards_listing_url" })
    return {
      notice: "Send the Awwwards listing/category URL in the next message.",
      view: "awwwards",
    }
  }

  if (data === "awwwards:reset_case_url") {
    awwwardsDraft.caseUrl = ""
    return { notice: "Case URL reset.", view: "awwwards" }
  }

  if (data === "awwwards:reset_listing_url") {
    awwwardsDraft.listingUrl = ""
    return { notice: "Listing URL reset to SOTD.", view: "awwwards" }
  }

  if (data === "awwwards:reset_source") {
    awwwardsDraft.caseUrl = ""
    awwwardsDraft.listingUrl = ""
    return { notice: "Awwwards source reset to default SOTD.", view: "awwwards" }
  }

  if (data === "attempts:-") {
    draft.attempts = Math.max(1, draft.attempts - 8)
    return { view: "quality" }
  }

  if (data === "attempts:+") {
    draft.attempts = Math.min(64, draft.attempts + 8)
    return { view: "quality" }
  }

  if (data === "min_score:-") {
    draft.minScore = Math.max(1, draft.minScore - 5)
    return { view: "quality" }
  }

  if (data === "min_score:+") {
    draft.minScore = Math.min(100, draft.minScore + 5)
    return { view: "quality" }
  }

  if (data === "schedule:posts:-") {
    scheduleDraft.postsPerDay = Math.max(1, scheduleDraft.postsPerDay - 1)
    return { view: "schedule" }
  }

  if (data === "schedule:posts:+") {
    scheduleDraft.postsPerDay = Math.min(5, scheduleDraft.postsPerDay + 1)
    return { view: "schedule" }
  }

  if (data === "schedule:interval:-") {
    scheduleDraft.dayInterval = Math.max(1, scheduleDraft.dayInterval - 1)
    return { view: "schedule" }
  }

  if (data === "schedule:interval:+") {
    scheduleDraft.dayInterval = Math.min(30, scheduleDraft.dayInterval + 1)
    return { view: "schedule" }
  }

  if (data === "schedule:save") {
    await Promise.all([
      upsertRepositoryVariable({
        token: config.githubToken,
        repository: config.githubRepository,
        name: "SCHEDULE_POSTS_PER_DAY",
        value: String(scheduleDraft.postsPerDay),
      }),
      upsertRepositoryVariable({
        token: config.githubToken,
        repository: config.githubRepository,
        name: "SCHEDULE_DAY_INTERVAL",
        value: String(scheduleDraft.dayInterval),
      }),
    ])

    return {
      notice: "Scheduled settings saved to GitHub.",
      view: "schedule",
    }
  }

  if (data.startsWith("preset:")) {
    const preset = parsePresetChoice(data.slice("preset:".length))
    draft.preset = preset

    if (!isPresetHarmonyCompatible(preset, draft.harmony)) {
      draft.harmony = "auto"
      return {
        notice: "Harmony reset to auto.",
        view: "preset",
      }
    }

    return { view: "preset" }
  }

  if (data.startsWith("color_count:")) {
    draft.colorCount = parseColorCountChoice(data.slice("color_count:".length))
    return { view: "color_count" }
  }

  if (data.startsWith("harmony:")) {
    const harmony = parseHarmonyChoice(data.slice("harmony:".length))

    if (!isPresetHarmonyCompatible(draft.preset, harmony)) {
      return {
        notice: `${harmony} is not supported for ${draft.preset}.`,
        view: "harmony",
      }
    }

    draft.harmony = harmony
    return { view: "harmony" }
  }

  if (data === "run") {
    if (!isPresetHarmonyCompatible(draft.preset, draft.harmony)) {
      return {
        notice: "Choose a compatible preset and harmony first.",
        view: "harmony",
      }
    }

    await dispatchWorkflow({
      token: config.githubToken,
      repository: config.githubRepository,
      workflowId: config.githubWorkflowId,
      ref: config.githubRef,
      inputs: {
        dry_run: String(draft.dryRun),
        attempts: String(draft.attempts),
        min_score: String(draft.minScore),
        color_count: draft.colorCount,
        preset: draft.preset,
        harmony: draft.harmony,
      },
    })
    return {
      notice: "Publish workflow dispatched.",
      view: "main",
    }
  }

  if (data === "awwwards:run") {
    await dispatchWorkflow({
      token: config.githubToken,
      repository: config.githubRepository,
      workflowId: config.githubAwwwardsWorkflowId,
      ref: config.githubRef,
      inputs: {
        dry_run: String(awwwardsDraft.dryRun),
        case_url: awwwardsDraft.caseUrl,
        listing_url: awwwardsDraft.listingUrl,
        enrich_from_screenshot: String(awwwardsDraft.enrichFromScreenshot),
        max_colors: awwwardsDraft.maxColors,
      },
    })
    return {
      notice: "Awwwards workflow dispatched.",
      view: "awwwards",
    }
  }

  throw new Error("Unknown action.")
}

async function sendPublishMenu(
  botToken: string,
  chatId: number,
  draft: PublishDraft,
  scheduleDraft: ScheduleDraft,
  awwwardsDraft: AwwwardsDraft,
  view: MenuView = "source",
  notice?: string,
) {
  await sendMessage(botToken, {
    chatId,
    text: renderDraft(draft, scheduleDraft, awwwardsDraft, view, notice),
    replyMarkup: createPublishKeyboard(draft, scheduleDraft, awwwardsDraft, view),
  })
}

async function editPublishMenu(
  botToken: string,
  chatId: number,
  messageId: number,
  draft: PublishDraft,
  scheduleDraft: ScheduleDraft,
  awwwardsDraft: AwwwardsDraft,
  view: MenuView,
  notice?: string,
) {
  try {
    await callTelegramApi(botToken, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: renderDraft(draft, scheduleDraft, awwwardsDraft, view, notice),
      reply_markup: createPublishKeyboard(
        draft,
        scheduleDraft,
        awwwardsDraft,
        view,
      ),
    })
  } catch (error) {
    if (isMessageNotModifiedError(error)) {
      return
    }

    throw error
  }
}

function renderDraft(
  draft: PublishDraft,
  scheduleDraft: ScheduleDraft,
  awwwardsDraft: AwwwardsDraft,
  view: MenuView,
  notice?: string,
) {
  if (view === "source") {
    return withNotice(
      [
        "Publication control",
        "",
        "Choose a publishing flow.",
        "",
        `Basic Palette: ${draft.dryRun ? "test / dry run" : "live publish"}`,
        `Awwwards: ${awwwardsDraft.dryRun ? "test / dry run" : "live publish"}`,
      ],
      notice,
    )
  }

  if (view === "quality") {
    return withNotice(
      [
        "Publish quality",
        "",
        `Minimum score: ${draft.minScore}`,
        `Strategy attempts: ${draft.attempts}`,
        "",
        "Higher score is stricter. More attempts gives the generator more chances to find a matching palette.",
      ],
      notice,
    )
  }

  if (view === "color_count") {
    return withNotice(
      [
        "Color count",
        "",
        `Current: ${draft.colorCount}`,
        "",
        "Auto chooses 2-5 colors for scheduled-style generation. Choose 1-5 when you want an exact count.",
      ],
      notice,
    )
  }

  if (view === "preset") {
    return withNotice(
      [
        "Palette preset",
        "",
        `Current: ${draft.preset}`,
        "",
        "Preset controls the overall visual character of the palette.",
      ],
      notice,
    )
  }

  if (view === "harmony") {
    return withNotice(
      [
        "Harmony mode",
        "",
        `Current: ${draft.harmony}`,
        "",
        draft.preset === "auto"
          ? "Harmony controls the relationship between colors."
          : `Showing modes supported by ${draft.preset}.`,
      ],
      notice,
    )
  }

  if (view === "schedule") {
    return withNotice(
      [
        "Scheduled publishing",
        "",
        `Posts per day: ${scheduleDraft.postsPerDay}`,
        `Day interval: every ${scheduleDraft.dayInterval} day${scheduleDraft.dayInterval === 1 ? "" : "s"}`,
        "",
        "Save sends these settings to GitHub repository variables.",
      ],
      notice,
    )
  }

  if (view === "awwwards") {
    return withNotice(
      [
        "Awwwards publishing",
        "",
        `Mode: ${awwwardsDraft.dryRun ? "test / dry run" : "live publish"}`,
        `Source: ${formatAwwwardsSource(awwwardsDraft)}`,
        `Case URL: ${formatOptionalUrl(awwwardsDraft.caseUrl)}`,
        `Listing URL: ${formatOptionalUrl(awwwardsDraft.listingUrl)}`,
        `Screenshot colors: ${awwwardsDraft.enrichFromScreenshot ? "on" : "off"}`,
        `Max colors: ${awwwardsDraft.maxColors}`,
        "",
        "Direct case URL has priority. Listing/category URL is used to find the latest item from that page.",
      ],
      notice,
    )
  }

  return withNotice(
    [
      "Basic Palette publishing",
      "",
      `Mode: ${draft.dryRun ? "test / dry run" : "live publish"}`,
      `Quality: score ${draft.minScore}, ${draft.attempts} attempts`,
      `Colors: ${draft.colorCount}`,
      `Preset: ${draft.preset}`,
      `Harmony: ${draft.harmony}`,
      `Scheduled: ${scheduleDraft.postsPerDay}/day, every ${scheduleDraft.dayInterval} day${scheduleDraft.dayInterval === 1 ? "" : "s"}`,
      "",
      "Open a section to adjust values, then run Publish.",
    ],
    notice,
  )
}

function createPublishKeyboard(
  draft: PublishDraft,
  scheduleDraft: ScheduleDraft,
  awwwardsDraft: AwwwardsDraft,
  view: MenuView,
) {
  if (view === "source") {
    return {
      inline_keyboard: [
        [{ text: "Basic Palette", callback_data: "view:main" }],
        [{ text: "Awwwards", callback_data: "view:awwwards" }],
      ],
    }
  }

  if (view === "quality") {
    return {
      inline_keyboard: [
        [
          { text: "- score", callback_data: "min_score:-" },
          { text: `score ${draft.minScore}`, callback_data: "view:quality" },
          { text: "+ score", callback_data: "min_score:+" },
        ],
        [
          { text: "- attempts", callback_data: "attempts:-" },
          { text: `${draft.attempts} attempts`, callback_data: "view:quality" },
          { text: "+ attempts", callback_data: "attempts:+" },
        ],
        [{ text: "Back", callback_data: "view:main" }],
      ],
    }
  }

  if (view === "color_count") {
    return {
      inline_keyboard: [
        ...chunk(
          colorCountChoices.map((colorCount) => ({
            text:
              colorCount === draft.colorCount ? `* ${colorCount}` : colorCount,
            callback_data: `color_count:${colorCount}`,
          })),
          3,
        ),
        [{ text: "Back", callback_data: "view:main" }],
      ],
    }
  }

  if (view === "preset") {
    return {
      inline_keyboard: [
        ...chunk(
          presetChoices.map((preset) => ({
            text: preset === draft.preset ? `* ${preset}` : preset,
            callback_data: `preset:${preset}`,
          })),
          2,
        ),
        [{ text: "Back", callback_data: "view:main" }],
      ],
    }
  }

  if (view === "harmony") {
    return {
      inline_keyboard: [
        ...chunk(
          getHarmonyChoicesForDraft(draft).map((harmony) => ({
            text: harmony === draft.harmony ? `* ${harmony}` : harmony,
            callback_data: `harmony:${harmony}`,
          })),
          2,
        ),
        [{ text: "Back", callback_data: "view:main" }],
      ],
    }
  }

  if (view === "schedule") {
    return {
      inline_keyboard: [
        [
          { text: "- posts", callback_data: "schedule:posts:-" },
          {
            text: `${scheduleDraft.postsPerDay} per day`,
            callback_data: "view:schedule",
          },
          { text: "+ posts", callback_data: "schedule:posts:+" },
        ],
        [
          { text: "- interval", callback_data: "schedule:interval:-" },
          {
            text: `every ${scheduleDraft.dayInterval}d`,
            callback_data: "view:schedule",
          },
          { text: "+ interval", callback_data: "schedule:interval:+" },
        ],
        [{ text: "Save Scheduled to GitHub", callback_data: "schedule:save" }],
        [{ text: "Back", callback_data: "view:main" }],
      ],
    }
  }

  if (view === "awwwards") {
    return {
      inline_keyboard: [
        [
          {
            text: `dry_run: ${awwwardsDraft.dryRun ? "on" : "off"}`,
            callback_data: "awwwards:toggle:dry_run",
          },
        ],
        [
          { text: "Set case URL", callback_data: "awwwards:set_case_url" },
          { text: "Clear case", callback_data: "awwwards:reset_case_url" },
        ],
        [
          {
            text: "Set listing URL",
            callback_data: "awwwards:set_listing_url",
          },
          {
            text: "Reset to SOTD",
            callback_data: "awwwards:reset_listing_url",
          },
        ],
        [
          {
            text: `screenshot colors: ${awwwardsDraft.enrichFromScreenshot ? "on" : "off"}`,
            callback_data: "awwwards:toggle:enrich",
          },
        ],
        ...chunk(
          awwwardsMaxColorsChoices.map((maxColors) => ({
            text:
              maxColors === awwwardsDraft.maxColors
                ? `* ${maxColors}`
                : maxColors,
            callback_data: `awwwards:max_colors:${maxColors}`,
          })),
          5,
        ),
        [{ text: "Reset source", callback_data: "awwwards:reset_source" }],
        [{ text: "Run Awwwards", callback_data: "awwwards:run" }],
        [{ text: "Back to menu", callback_data: "view:source" }],
      ],
    }
  }

  return {
    inline_keyboard: [
      [
        {
          text: `dry_run: ${draft.dryRun ? "on" : "off"}`,
          callback_data: "toggle:dry_run",
        },
      ],
      [
        { text: `Colors: ${draft.colorCount}`, callback_data: "view:color_count" },
        { text: "Quality", callback_data: "view:quality" },
      ],
      [
        { text: `Preset: ${draft.preset}`, callback_data: "view:preset" },
      ],
      [{ text: `Harmony: ${draft.harmony}`, callback_data: "view:harmony" }],
      [{ text: "Scheduled", callback_data: "view:schedule" }],
      [{ text: "Run Publish", callback_data: "run" }],
      [{ text: "Back to menu", callback_data: "view:source" }],
    ],
  }
}

function getDraft(drafts: Map<number, PublishDraft>, userId: number) {
  const existingDraft = drafts.get(userId)

  if (existingDraft) {
    return existingDraft
  }

  const draft = {
    dryRun: true,
    attempts: 32,
    minScore: 70,
    colorCount: "auto",
    preset: "auto",
    harmony: "auto",
  } satisfies PublishDraft
  drafts.set(userId, draft)

  return draft
}

function getScheduleDraft(
  scheduleDrafts: Map<number, ScheduleDraft>,
  userId: number,
) {
  const existingDraft = scheduleDrafts.get(userId)

  if (existingDraft) {
    return existingDraft
  }

  const draft = {
    postsPerDay: 1,
    dayInterval: 1,
  } satisfies ScheduleDraft
  scheduleDrafts.set(userId, draft)

  return draft
}

function getAwwwardsDraft(
  awwwardsDrafts: Map<number, AwwwardsDraft>,
  userId: number,
) {
  const existingDraft = awwwardsDrafts.get(userId)

  if (existingDraft) {
    return existingDraft
  }

  const draft = {
    dryRun: true,
    caseUrl: "",
    listingUrl: "",
    enrichFromScreenshot: true,
    maxColors: "5",
  } satisfies AwwwardsDraft
  awwwardsDrafts.set(userId, draft)

  return draft
}

async function getUpdates(botToken: string, offset: number) {
  const payload = await callTelegramApi<TelegramUpdate[]>(botToken, "getUpdates", {
    offset,
    timeout: 30,
    allowed_updates: ["message", "callback_query"],
  })

  return payload
}

async function sendMessage(
  botToken: string,
  options: {
    chatId: number
    text: string
    replyMarkup?: unknown
  },
) {
  await callTelegramApi(botToken, "sendMessage", {
    chat_id: options.chatId,
    text: options.text,
    reply_markup: options.replyMarkup,
  })
}

async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
) {
  await callTelegramApi(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  })
}

async function callTelegramApi<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as TelegramApiResponse<T>

  if (!payload.ok) {
    throw new Error(
      `Telegram ${method} failed: ${payload.description ?? response.statusText}`,
    )
  }

  return payload.result
}

function isMessageNotModifiedError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("message is not modified")
  )
}

async function loadControlBotConfig(envPath: string) {
  const fileEnv = await readOptionalEnvFile(envPath)
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? fileEnv.TELEGRAM_BOT_TOKEN
  const adminUserIds =
    process.env.TELEGRAM_ADMIN_USER_IDS ?? fileEnv.TELEGRAM_ADMIN_USER_IDS
  const githubToken = process.env.GITHUB_TOKEN ?? fileEnv.GITHUB_TOKEN
  const githubRepository =
    process.env.GITHUB_REPOSITORY ??
    fileEnv.GITHUB_REPOSITORY ??
    "offbody/palette-bot"
  const githubWorkflowId =
    process.env.GITHUB_WORKFLOW_ID ??
    fileEnv.GITHUB_WORKFLOW_ID ??
    "publish.yml"
  const githubAwwwardsWorkflowId =
    process.env.GITHUB_AWWWARDS_WORKFLOW_ID ??
    fileEnv.GITHUB_AWWWARDS_WORKFLOW_ID ??
    "publish-awwwards.yml"
  const githubRef = process.env.GITHUB_REF ?? fileEnv.GITHUB_REF ?? "main"

  if (!botToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN.")
  }

  if (!adminUserIds) {
    throw new Error("Missing TELEGRAM_ADMIN_USER_IDS.")
  }

  if (!githubToken) {
    throw new Error("Missing GITHUB_TOKEN.")
  }

  return {
    botToken,
    adminUserIds: parseAdminUserIds(adminUserIds),
    githubToken,
    githubRepository,
    githubWorkflowId,
    githubAwwwardsWorkflowId,
    githubRef,
  } satisfies ControlBotConfig
}

async function readOptionalEnvFile(envPath: string) {
  try {
    return await readEnvFile(envPath)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if ((error as { code?: string }).code === "ENOENT") {
        return {}
      }
    }

    throw error
  }
}

async function readEnvFile(envPath: string) {
  const content = await readFile(envPath, "utf8")
  const values: Record<string, string> = {}

  for (const line of content.split("\n")) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    values[trimmedLine.slice(0, separatorIndex).trim()] = unquote(
      trimmedLine.slice(separatorIndex + 1).trim(),
    )
  }

  return values
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function parseAdminUserIds(value: string) {
  const adminUserIds = new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number.parseInt(part, 10)),
  )

  if (
    adminUserIds.size === 0 ||
    Array.from(adminUserIds).some((userId) => !Number.isInteger(userId))
  ) {
    throw new Error("TELEGRAM_ADMIN_USER_IDS must contain Telegram numeric user ids.")
  }

  return adminUserIds
}

function parseMenuView(value: string): MenuView {
  if (
    value === "source" ||
    value === "main" ||
    value === "quality" ||
    value === "color_count" ||
    value === "preset" ||
    value === "harmony" ||
    value === "schedule" ||
    value === "awwwards"
  ) {
    return value
  }

  throw new Error(`Unknown menu view: ${value}`)
}

function parsePresetChoice(value: string): PresetChoice {
  if (presetChoices.includes(value as PresetChoice)) {
    return value as PresetChoice
  }

  throw new Error(`Unknown preset: ${value}`)
}

function parseColorCountChoice(value: string): ColorCountChoice {
  if (colorCountChoices.includes(value as ColorCountChoice)) {
    return value as ColorCountChoice
  }

  throw new Error(`Unknown color count: ${value}`)
}

function parseHarmonyChoice(value: string): HarmonyChoice {
  if (harmonyChoices.includes(value as HarmonyChoice)) {
    return value as HarmonyChoice
  }

  throw new Error(`Unknown harmony: ${value}`)
}

function parseAwwwardsMaxColorsChoice(value: string): AwwwardsMaxColorsChoice {
  if (awwwardsMaxColorsChoices.includes(value as AwwwardsMaxColorsChoice)) {
    return value as AwwwardsMaxColorsChoice
  }

  throw new Error(`Unknown Awwwards max colors: ${value}`)
}

function applyPendingInput(
  draft: AwwwardsDraft,
  pendingInput: PendingInput,
  rawValue: string,
) {
  if (pendingInput.type === "awwwards_case_url") {
    draft.caseUrl = normalizeAwwwardsCaseUrl(rawValue)

    if (draft.caseUrl) {
      draft.listingUrl = ""
      return "Case URL saved. Listing URL cleared."
    }

    return "Case URL cleared."
  }

  draft.listingUrl = normalizeAwwwardsListingUrl(rawValue)

  if (draft.listingUrl) {
    draft.caseUrl = ""
    return "Listing URL saved. Case URL cleared."
  }

  return "Listing URL reset to default SOTD."
}

function normalizeAwwwardsCaseUrl(rawValue: string) {
  const url = normalizeOptionalAwwwardsUrl(rawValue)

  if (!url) {
    return ""
  }

  if (!new URL(url).pathname.startsWith("/sites/")) {
    throw new Error("Case URL should look like https://www.awwwards.com/sites/...")
  }

  return url
}

function normalizeAwwwardsListingUrl(rawValue: string) {
  return normalizeOptionalAwwwardsUrl(rawValue)
}

function normalizeOptionalAwwwardsUrl(rawValue: string) {
  const trimmedValue = rawValue.trim()

  if (
    trimmedValue.length === 0 ||
    trimmedValue === "-" ||
    trimmedValue.toLowerCase() === "default"
  ) {
    return ""
  }

  let url: URL

  try {
    url = new URL(trimmedValue)
  } catch {
    throw new Error("Send a valid URL or `default` to reset.")
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Use an http or https URL.")
  }

  if (!url.hostname.endsWith("awwwards.com")) {
    throw new Error("Use an Awwwards URL.")
  }

  return url.toString()
}

function formatAwwwardsSource(draft: AwwwardsDraft) {
  if (draft.caseUrl) {
    return "direct case URL"
  }

  if (draft.listingUrl) {
    return "listing/category URL"
  }

  return "default SOTD"
}

function formatOptionalUrl(value: string) {
  return value || "default"
}

function withNotice(lines: string[], notice?: string) {
  if (!notice) {
    return lines.join("\n")
  }

  return [`Notice: ${notice}`, "", ...lines].join("\n")
}

function getHarmonyChoicesForDraft(draft: PublishDraft): readonly HarmonyChoice[] {
  if (draft.preset === "auto") {
    return harmonyChoices
  }

  return ["auto", ...getPaletteHarmoniesForPreset(draft.preset)]
}

function isPresetHarmonyCompatible(
  preset: PresetChoice,
  harmony: HarmonyChoice,
) {
  if (preset === "auto" || harmony === "auto") {
    return true
  }

  return getPaletteHarmoniesForPreset(preset).includes(harmony)
}

function isAdmin(config: ControlBotConfig, userId?: number) {
  return userId !== undefined && config.adminUserIds.has(userId)
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size))
  }

  return rows
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
      throw new Error(`Missing value for --${key}`)
    }

    parsed[key] = value
    index += 1
  }

  return parsed
}
