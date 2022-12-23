import { MessageEntity, Update } from "grammy/types";
import { BotBuilder, BotContext, BotRecord } from "../api/types.js";
import { manager, db } from "../api/index.js";
import { InlineKeyboard, NextFunction } from "grammy";
import { limit } from "@grammyjs/ratelimiter";

class TrackJoinedGroups {
	groups_by_bot: Record<number, { handler: (update: Update) => void; groups: Set<{ id: number; title: string }> }> = {};

	get_groups(id: number) {
		return this.groups_by_bot[id]?.groups ?? new Set();
	}

	startTracking(id: number) {
		if (this.groups_by_bot[id]) return;

		const groups = new Set<{ id: number; title: string }>();

		const handler = (update: Update) => {
			if (!update.message?.new_chat_members?.some((member) => member.id === id)) return;
			if (update.message.chat.type !== "group" && update.message.chat.type !== "supergroup") return;
			groups.add({ id: update.message.chat.id, title: update.message.chat.title });
		};

		manager.temp_bots_handlers[String(id)] = handler;
		this.groups_by_bot[id] = { handler, groups };
	}

	stopTracking(id: number) {
		delete manager.temp_bots_handlers[String(id)];
		delete this.groups_by_bot[id];
	}
}

const tracker = new TrackJoinedGroups();

function moveEntities(entities: MessageEntity[], by: number) {
	const new_entities: MessageEntity[] = [];
	for (const entity of entities) {
		new_entities.push({ ...entity, offset: entity.offset + by });
	}
	return new_entities;
}

export default {
	slug: "dcconfesiones",
	name: "DCConfesiones",
	description: "Backend para el bot DCConfesiones.",
	async ask_meta(bot, conversation, ctx, { id }) {
		// Get group
		await conversation.external(() => tracker.startTracking(id));

		const wait_keyboard = new InlineKeyboard().text("Listo", "dcconfesiones::should-be-added");

		const msg = await ctx.reply("Añade el bot a un grupo para continuar.", { reply_markup: wait_keyboard });
		const editMsg = async (text: string, reply_markup?: InlineKeyboard) => {
			await ctx.api.editMessageText(msg.chat.id, msg.message_id, text, { reply_markup });
		};

		let groups: Set<{ id: number; title: string }>;
		while (true) {
			await conversation.waitForCallbackQuery("dcconfesiones::should-be-added");
			groups = await conversation.external(() => tracker.get_groups(id));
			if (groups.size > 0) break;

			await editMsg("No se detectó que el bot fue añadido. Añade el bot a un grupo para continuar.", wait_keyboard);
		}

		// Select group
		const okKeyboard = new InlineKeyboard();
		for (const g of groups) okKeyboard.text(g.title, `dcconfesiones::group::${g.id}`);

		await ctx.reply("Elige el grupo al que se enviarán las confesiones.", { reply_markup: okKeyboard });

		const group_id = Number(((await conversation.waitForCallbackQuery(/dcconfesiones::group::(-?\d+)/)).match as RegExpMatchArray)[1]);

		const group_title = [...groups].find((g) => g.id === group_id)?.title;
		if (!group_title) throw new Error("El bot no se añadió a un grupo.");

		await conversation.external(() => tracker.stopTracking(id));
		return { group_id, group_title, counter: 0 };
	},
	async attach_to_instance(bot, { meta, ...record }) {
		const timeFrame = 5_000;
		const timeLimit = 3;
		const onLimitExceeded = (ctx: BotContext) => ctx.reply(`Limite de mensajes alcanzado ${timeLimit} en ${timeFrame / 1_000}s.`);

		bot.use(limit({ timeFrame, limit: timeLimit, onLimitExceeded }));
		bot.on("message", async (ctx, next) => {
			ctx.prefix = `Confesión #${meta.counter}\n`;
			try {
				await next();
			} catch (e) {
				console.error(e);
				await ctx.reply("No se pudo enviar la confesión.");
			}
			meta.counter++;
			await db.collection("bots").update<BotRecord>(record.id, { meta, ...record });
		});
		bot.on("message:text", async (ctx) => {
			const entities = moveEntities(ctx.message.entities ?? [], ctx.prefix.length);
			await ctx.api.sendMessage(meta.group_id, `${ctx.prefix}${ctx.message.text}`, { entities });
		});
		bot.on("message:photo", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendPhoto(meta.group_id, ctx.message.photo[0].file_id, { caption: `${ctx.prefix}${ctx.message.caption}`, caption_entities });
		});
		bot.on("message:video", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendVideo(meta.group_id, ctx.message.video.file_id, { caption: `${ctx.prefix}${ctx.message.caption}`, caption_entities });
		});
		bot.on("message:animation", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendAnimation(meta.group_id, ctx.message.animation.file_id, { caption: `${ctx.prefix}${ctx.message.caption}`, caption_entities });
		});
		bot.on("message:audio", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendAudio(meta.group_id, ctx.message.audio.file_id, { caption: `${ctx.prefix}${ctx.message.caption}`, caption_entities });
		});
		bot.on("message:voice", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendVoice(meta.group_id, ctx.message.voice.file_id, { caption: `${ctx.prefix}${ctx.message.caption}`, caption_entities });
		});
		bot.on("message:document", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendDocument(meta.group_id, ctx.message.document.file_id, { caption: `${ctx.prefix}${ctx.message.caption}`, caption_entities });
		});
		bot.on("message:sticker", async (ctx) => {
			await ctx.api.sendSticker(meta.group_id, ctx.message.sticker.file_id);
		});
		bot.on("message:dice", async (ctx) => {
			await ctx.api.sendDice(meta.group_id, ctx.message.dice.emoji);
		});
		bot.on("message:poll", async (ctx) => {
			// TODO: Resend poll if the poll was resended
			console.log(ctx.message);
			if (ctx.message.forward_from) {
				await ctx.api.forwardMessage(meta.group_id, ctx.from.id, ctx.message.message_id);
			} else {
				const { options, ...rest } = ctx.message.poll || {};
				const text_options = ctx.message.poll.options.map((o) => o.text);
				await ctx.api.sendPoll(meta.group_id, ctx.message.poll.question, text_options, rest);
			}
		});
	},
} satisfies BotBuilder<{ group_id: number; counter: number }, { prefix: string }>;
