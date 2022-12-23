import { Scenes, Telegraf } from "telegraf";
import { Stage, WizardScene } from "telegraf/scenes";
import PocketBase from "pocketbase";
import { telegrafThrottler } from "telegraf-throttler";
import TelegrafStatelessQuestion from "telegraf-stateless-question";

const bot_token = process.env.BOT_TOKEN;
if (typeof bot_token !== "string") throw new Error("BOT_TOKEN env var is not set");

const bot = new Telegraf(bot_token);
bot.use(telegrafThrottler());

bot.telegram.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "hi", description: "Say hi!" },
]);

const constBotTokenQuestion = new TelegrafStatelessQuestion("bot_token", async (ctx) => {


bot.start((ctx) => ctx.reply("Welcome!"));
bot.command("create_bot", (ctx) => {
  ctx.reply("Envía el token del bot");
});

process.once("SIGTERM", () => bot.stop("SIGTERM"));
process.once("SIGINT", () => bot.stop("SIGINT"));
bot.launch();
