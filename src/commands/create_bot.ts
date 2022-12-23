import { createConversation } from "@grammyjs/conversations";
import { Bot, Keyboard } from "grammy";

import { UserFromGetMe } from "grammy/types";
import { manager } from "../api/index.js";
import { Command, BotContext, ConversationFn } from "../api/types.js";

// const create_bot_type_keyboard =

const get_bot = (async (conversation, ctx) => {
	await ctx.reply("Hola! Empezamos a configurar tu bot.\nEnvía el token del bot:");
	while (true) {
		const token = await conversation.form.text();
		const bot = new Bot(token);

		try {
			const data = await conversation.external(() => bot.api.getMe());
			return { data, bot, token };
		} catch {
			await ctx.reply("El token no es válido, vuelve a intentarlo.");
		}
	}
}) satisfies ConversationFn;

const create_bot_conversation: ConversationFn = async (conversation, ctx) => {
	if (!ctx.from) return ctx.reply("No se pudo obtener la información del usuario.");
	if (ctx.from.is_bot) return ctx.reply("Los bots no pueden crear bots.");

	const bot_to_create = await get_bot(conversation, ctx);

	if (manager.bot_info.id === bot_to_create.data.id) {
		return ctx.reply("Este bot y el bot a crear no pueden ser el mismo.");
	}

	if (manager.botExists(bot_to_create.data.id)) {
		return ctx.reply("El bot a crear no puede ser un bot.");
	}

	ctx.reply(`Conectado al bot @${bot_to_create.data.username}\nIngresa el tipo de bot:`, {
		reply_markup: new Keyboard([manager.builders.map(({ name }) => ({ text: name }))]).oneTime(),
	});

	const bot_type_name = await conversation.form.select(manager.builders.map(({ name }) => name));

	const builder = manager.builders.find((builder) => builder.name === bot_type_name);
	if (!builder) return await ctx.reply("No se encontró el tipo de bot.");

	let meta = {};
	if (builder.ask_meta) {
		await ctx.reply("El bot necesita información adicional para funcionar.");
		await manager.setupTempBot(bot_to_create.data.id, bot_to_create.bot);
		meta = await builder.ask_meta(bot_to_create.bot as any, conversation, ctx, bot_to_create.data);
		await ctx.reply(`Información adicional:\n${JSON.stringify(meta, null, 1)}`);
	}

	await ctx.reply(
		`Para confirmar, se estaría creando el backend ${bot_type_name} para
    el bot @${bot_to_create.data.username}.\n El bot estará asociado a tu
    cuenta ${ctx.from.username ? `@${ctx.from.username}` : ""} para que
    puedas administrarlo luego. ¿Estás seguro?`.replaceAll(/\s+/g, " "),
		{ reply_markup: new Keyboard().text("Sí").text("No").oneTime() }
	);

	const confirmation = await conversation.form.select(["Sí", "No"]);

	if (confirmation === "No") return ctx.reply("Operación cancelada.");

	await ctx.reply("Creando bot...");

	try {
		await manager.createBot({
			bot_id: bot_to_create.data.id,
			bot_type: builder.slug,
			bot_token: bot_to_create.token,
			bot_username: bot_to_create.data.username,
			user_id: ctx.from.id,
			user_username: ctx.from.username ?? ctx.from.first_name,
			bot_call_count: 0,
			meta,
		});

		await ctx.reply("Bot creado con éxito.");
	} catch (error) {
		console.error(JSON.stringify((error as any).data));
		await ctx.reply("Hubo un error al crear el bot.");
	}
};

export default {
	name: "create_bot",
	description: "Permite crear un backend para el bot.",
	middlewares: [createConversation(create_bot_conversation)],
	command: (ctx) => ctx.conversation.enter(create_bot_conversation.name),
} satisfies Command;
