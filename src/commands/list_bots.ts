import { db } from "../api/db.js";
import { BotRecord, Command } from "../api/types.js";

export default {
	name: "list_bots",
	description: "Ve todos tus bots registrados.",
	command: async (ctx) => {
		if (!ctx.from) return ctx.reply("No se pudo obtener la información del usuario.");
		const bots = await db.collection("bots").getFullList<BotRecord>(12, { filter: `user_id = ${ctx.from.id}` });
		if (bots.length == 0) return ctx.reply("No tienes ningún bot registrado.");
		await ctx.reply(`Tienes los siguientes bots registrados:\n${bots.map((bot) => `- @${bot.bot_username}`).join("\n")}`);
	},
} satisfies Command;
