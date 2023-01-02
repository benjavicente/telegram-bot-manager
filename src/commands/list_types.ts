import { Command } from "../api/types.js";
import { manager } from "../api/index.js";

export default {
	name: "list_types",
	description: "Ve todos los tipos de bots.",
	command: async (ctx) => {
		const types = manager.builders.map(({ name }) => name);
		await ctx.reply(`Los tipos de bots disponibles son:\n${types.map((type) => `- ${type}`).join("\n")}`);
	},
} satisfies Command;
