import { conversations } from "@grammyjs/conversations";
import { db, dbHealthCheck } from "./db.js";
import { Bot, session } from "grammy";
import { hydrate } from "@grammyjs/hydrate";
import { BotBuilder, BotContext, BotRecord, Command, HandleTempBotUpdate, ManagedBot } from "./types.js";

import { loadModules } from "./utils.js";
import { Update } from "grammy/types";

export class ManagerBot {
  bot: Bot<BotContext>;
  temp_bots_handlers: { [id: string]: HandleTempBotUpdate } = {};
  private webhook_url: string;
  private managed_bots: { [id: string]: ManagedBot } = {};
  private bot_builders: { [slug: string]: BotBuilder } = {};

  constructor() {
    const { BOT_TOKEN, WEBHOOK_URL } = process.env;
    if (typeof BOT_TOKEN !== "string") throw new Error("BOT_TOKEN env var is not set");
    if (typeof WEBHOOK_URL !== "string") throw new Error("WEBHOOK_URL env var is not set");

    this.webhook_url = WEBHOOK_URL;
    this.bot = new Bot<BotContext>(BOT_TOKEN);

    this.bot.use(hydrate());
    this.bot.use(session({ initial: () => ({}) }));
    this.bot.use(conversations());
  }

  /** Setup the bot */
  async init() {
    await dbHealthCheck();
    await this.bot.init();
    await this.bot.api.setWebhook(this.webhook_url);
    await this.loadCommands();
    await this.loadBotBuilders();
    await this.loadCreatedBots();
    console.log(`Bot @${this.bot_info.username} is ready at ${this.webhook_url}`);
  }

  // Getters

  get builders() {
    return Object.values(this.bot_builders);
  }

  get bot_info() {
    return this.bot.botInfo;
  }

  getBotByID(id: number): ManagedBot | undefined {
    return this.managed_bots[id];
  }

  botExists(id: number): boolean {
    return this.getBotByID(id) !== undefined;
  }

  // Create + delete

  async createBot(record: Omit<BotRecord, "id">) {
    const created_record = await db.collection("bots").create<BotRecord>(record);
    await this.loadBot(created_record);
  }

  async deleteBot(id: number) {
    const bot = this.managed_bots[id];
    await bot.instance.api.deleteWebhook();
    await db.collection("bots").delete(bot.record.id);
    delete this.managed_bots[id];
  }

  async setupTempBot(id: number, bot: Bot<any>) {
    bot.use(hydrate());
    await bot.api.setWebhook(`${this.webhook_url}/temp/${id}`);
  }

  // Intercept requests

  async handleManagedBotUpdate(id: number, update: Update) {
    const bot = this.getBotByID(id);
    if (!bot) throw new Error(`Could not find bot with id ${id}`);
    await bot.instance.handleUpdate(update);
  }

  // Loaders

  private async loadCommands() {
    const commands = await loadModules<Command>("./commands/*.js");
    this.bot.use(...commands.flatMap((command) => command.middlewares || []));
    for (const command of commands) this.bot.command(command.name, command.command);
    await this.bot.api.setMyCommands(commands.map(({ name, description }) => ({ command: name, description })));
  }

  private async loadBotBuilders() {
    const bot_builders = await loadModules<BotBuilder>("./bots/*.js");
    this.bot_builders = Object.fromEntries(bot_builders.map((builder) => [builder.slug, builder]));
  }

  private async loadCreatedBots() {
    const bots_records = await db.collection("bots").getFullList<BotRecord>();
    await Promise.all(bots_records.map((bot) => this.loadBot(bot)));
  }

  private async loadBot(record: BotRecord) {
    console.log(`Loading bot @${record.bot_username} of type ${record.bot_type}`);

    const builder = this.bot_builders[record.bot_type];
    if (!builder) throw new Error(`Could not find builder for bot type ${record.bot_type}`);

    const bot = new Bot<BotContext>(record.bot_token);

    bot.use(hydrate());
    await builder.attach_to_instance(bot, record);
    await bot.api.setWebhook(`${this.webhook_url}/${record.bot_id}`);
    await bot.init();
    this.managed_bots[record.bot_id] = { instance: bot, record };
  }
}

export const manager = new ManagerBot();
