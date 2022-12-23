import { createConversation } from "@grammyjs/conversations";
import { Api, InlineKeyboard } from "grammy";

import { manager, db } from "../api/index.js";
import { BotRecord, Command, ConversationFn } from "../api/types.js";

const delete_bot_conversation = (async (conversation, ctx) => {
	const { from } = ctx;
	if (!from) return ctx.reply("No se pudo obtener la información del usuario.");

	const bots_records = await conversation.external(() => db.collection("bots").getFullList<BotRecord>(12, { filter: `user_id = ${from.id}` }));

	if (bots_records.length == 0) return ctx.reply("No tienes ningún bot registrado.");

	const msg = await ctx.reply("Que bot quieres eliminar?", {
		reply_markup: new InlineKeyboard([bots_records.map((br) => ({ text: br.bot_username, callback_data: `delete-bot::id::${br.bot_id}` }))]),
	});

	const bot_id = Number(((await conversation.waitForCallbackQuery(/delete-bot::id::(\d+)/)).match as RegExpMatchArray)[1]);

	const bot_to_delete = manager.getBotByID(bot_id);
	if (!bot_to_delete) return ctx.reply("No se pudo encontrar el bot que quieres eliminar.");

	const editMessage = async (text: string, reply_markup?: InlineKeyboard) => {
		await ctx.api.editMessageText(from.id, msg.message_id, text, { reply_markup });
	};

	await editMessage(
		`¿Estás seguro de eliminar el bot @${bot_to_delete.record.bot_username}?`,
		new InlineKeyboard([[{ text: "Sí", callback_data: `delete-bot::${bot_id}::confirm` }], [{ text: "No", callback_data: `delete-bot::${bot_id}::cancel` }]])
	);

	const [_, confirm_bot_id, confirmation] = (await conversation.waitForCallbackQuery(/delete-bot::(\d+)::(confirm|cancel)/)).match as RegExpMatchArray;

	if (Number(confirm_bot_id) != bot_id) return ctx.reply("No se pudo encontrar el bot que quieres eliminar.");

	if (confirmation == "cancel") {
		await editMessage("Eliminación cancelada.");
		return await ctx.conversation.exit();
	}

	await conversation.external(() => manager.deleteBot(bot_id));
	await editMessage("Bot eliminado.\nRecuerda que los tokens lo administra @BotFather.");
}) satisfies ConversationFn;

export default {
	name: "delete_bot",
	description: "Eliminar un bot.",
	middlewares: [createConversation(delete_bot_conversation)],
	command: (ctx) => ctx.conversation.enter(delete_bot_conversation.name),
} satisfies Command;
