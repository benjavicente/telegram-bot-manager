import type { Bot, Context, Middleware } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type PocketBase from "pocketbase";

export { ManagerBot } from "./manager.js";

export type DB = PocketBase;

export type BotContext = HydrateFlavor<Context & ConversationFlavor>;

export type BotConversation = Conversation<BotContext>;
export type ConversationFn<T = any> = (conversation: BotConversation, ctx: BotContext) => Promise<T>;

export type HandleTempBotUpdate = (update: Update) => void;

export type BotRecord<M extends {} = {}> = {
	id: string;
	bot_id: number;
	bot_type: string;
	bot_token: string;
	bot_username: string;
	user_id: number;
	bot_call_count: number | null;
	user_username: string | null;
	meta: M;
};

export type ManagedBot<M extends {} = {}> = {
	instance: Bot<BotContext>;
	record: BotRecord<M>;
};

export type Command = {
	name: string;
	description: string;
	middlewares?: Middleware<BotContext>[];
	command(ctx: BotContext): void;
};

export type BotBuilder<M extends {} = {}, C extends {} = {}> = {
	slug: string;
	name: string;
	description: string;
	ask_meta?: (bot: Bot<BotContext>, conversation: BotConversation, ctx: BotContext, data: UserFromGetMe) => Promise<M>;
	attach_to_instance: (bot: Bot<BotContext & C>, record: BotRecord<M>) => Promise<void>;
};
