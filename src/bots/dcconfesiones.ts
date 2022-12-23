import { Chat, MessageEntity, Update } from "grammy/types";
import { BotBuilder, BotRecord } from "../api/types.js";
import { manager, db } from "../api/index.js";
import { Context, InlineKeyboard } from "grammy";
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
			console.log("New group", update.message.chat.title);
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

		const group_add_keyboard = new InlineKeyboard()
			.text("Añadir por id", "dcconfesiones::add-by::id")
			.text("Añadir al invitar", "dcconfesiones::add-by::invite");

		await ctx.reply("¿Cómo deseas añadir al bot?", { reply_markup: group_add_keyboard });
		const selected = ((await conversation.waitForCallbackQuery(/dcconfesiones::add-by::(id|invite)/)).match as RegExpMatchArray)[1];

		let group_id: number;
		if (selected === "id") {
			await ctx.reply("Envía el id del grupo.");
			const group_id_msg = await conversation.form.text();
			group_id = Number(group_id_msg);
		} else {
			const wait_keyboard = new InlineKeyboard().text("Listo", "dcconfesiones::should-be-added");
			const msg = await ctx.reply("Añade el bot a un grupo para continuar.", { reply_markup: wait_keyboard });

			await conversation.waitForCallbackQuery("dcconfesiones::should-be-added");
			let groups = await conversation.external(() => tracker.get_groups(id));

			if (groups.size === 0) {
				await ctx.api.editMessageText(msg.chat.id, msg.message_id, "No has añadido el bot a ningún grupo. Vuelve a intentarlo.", {
					reply_markup: wait_keyboard,
				});
				while (groups.size === 0) {
					await conversation.waitForCallbackQuery("dcconfesiones::should-be-added");
					groups = await conversation.external(() => tracker.get_groups(id));
				}
			}

			// Select group
			const okKeyboard = new InlineKeyboard();
			for (const g of groups) okKeyboard.text(g.title, `dcconfesiones::group::${g.id}`);

			await ctx.reply("Elige el grupo al que se enviarán las confesiones.", { reply_markup: okKeyboard });

			group_id = Number(((await conversation.waitForCallbackQuery(/dcconfesiones::group::(-?\d+)/)).match as RegExpMatchArray)[1]);
		}

		const chat: Chat = await bot.api.getChat(String(group_id));
		if (chat.type !== "group" && chat.type !== "supergroup") throw new Error("El chat no es un grupo.");

		await conversation.external(() => tracker.stopTracking(id));
		return { group_id, group_title: chat.title, counter: 0, stopped: false };
	},
	async attach_to_instance(bot, { meta, ...record }) {
		const timeFrame = 30_000;
		const timeLimit = 3;

		const limitMiddleware = limit({
			timeFrame,
			limit: timeLimit,
			onLimitExceeded: (ctx: Context) => ctx.reply(`Limite de mensajes alcanzado ${timeLimit} en ${timeFrame / 1_000}s.`),
		});

		bot.use((ctx, next) => {
			// Solo en chats privados
			if (ctx.chat?.type !== "private") return;
			// Setear propietario
			ctx.is_owner = ctx.from?.id === record.user_id;
			// El limite es solo para los no propietarios
			if (!ctx.is_owner) return limitMiddleware(ctx, next);
			return next();
		});

		bot.command("start", async (ctx) => {
			if (meta.stopped && !ctx.is_owner) return await ctx.reply("El bot está desactivado.");

			if (!ctx.is_owner) return await ctx.reply("👋");

			meta.stopped = false;
			await db.collection("bots").update<BotRecord>(record.id, { meta, ...record });
			await ctx.reply("El bot está activado. Todos pueden mandar confesiones.");
		});

		bot.command("stop", async (ctx) => {
			if (!ctx.is_owner) return;

			meta.stopped = true;
			await db.collection("bots").update<BotRecord>(record.id, { meta, ...record });
			await ctx.reply("El bot ha sido desactivado. Solo tú puedes mandar confesiones.");
		});

		bot.on("message", async (ctx, next) => {
			if (meta.stopped && record.user_id !== ctx.from?.id) return;

			ctx.prefix = `Confesión #${meta.counter++}\n`;
			try {
				await next();
				await db.collection("bots").update<BotRecord>(record.id, { meta, ...record });
			} catch (e) {
				console.error(e);
				await ctx.reply("No se pudo enviar la confesión.");
			}
		});

		bot.on("message:text", async (ctx) => {
			const entities = moveEntities(ctx.message.entities ?? [], ctx.prefix.length);
			await ctx.api.sendMessage(meta.group_id, `${ctx.prefix}${ctx.message.text}`, { entities });
		});
		bot.on("message:photo", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendPhoto(meta.group_id, ctx.message.photo[0].file_id, { caption: `${ctx.prefix}${ctx.message.caption ?? ""}`, caption_entities });
		});
		bot.on("message:video", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendVideo(meta.group_id, ctx.message.video.file_id, { caption: `${ctx.prefix}${ctx.message.caption ?? ""}`, caption_entities });
		});
		bot.on("message:animation", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendAnimation(meta.group_id, ctx.message.animation.file_id, { caption: `${ctx.prefix}${ctx.message.caption ?? ""}`, caption_entities });
		});
		bot.on("message:audio", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendAudio(meta.group_id, ctx.message.audio.file_id, { caption: `${ctx.prefix}${ctx.message.caption ?? ""}`, caption_entities });
		});
		bot.on("message:voice", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendVoice(meta.group_id, ctx.message.voice.file_id, { caption: `${ctx.prefix}${ctx.message.caption ?? ""}`, caption_entities });
		});
		bot.on("message:document", async (ctx) => {
			const caption_entities = moveEntities(ctx.message.caption_entities ?? [], ctx.prefix.length);
			await ctx.api.sendDocument(meta.group_id, ctx.message.document.file_id, { caption: `${ctx.prefix}${ctx.message.caption ?? ""}`, caption_entities });
		});
		bot.on("message:sticker", async (ctx) => {
			await ctx.api.sendSticker(meta.group_id, ctx.message.sticker.file_id);
		});
		bot.on("message:dice", async (ctx) => {
			await ctx.api.sendDice(meta.group_id, ctx.message.dice.emoji);
		});
		bot.on("message:poll", async (ctx) => {
			if (ctx.message.forward_from) {
				await ctx.api.forwardMessage(meta.group_id, ctx.from.id, ctx.message.message_id);
			} else {
				const { options, ...rest } = ctx.message.poll || {};
				const text_options = ctx.message.poll.options.map((o) => o.text);
				await ctx.api.sendPoll(meta.group_id, `${ctx.prefix}${ctx.message.poll.question}`, text_options, rest);
			}
		});
	},
} satisfies BotBuilder<{ group_id: number; counter: number; stopped: boolean }, { prefix: string; is_owner: boolean }>;
