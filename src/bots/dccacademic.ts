import { BotBuilder } from "api/types.js";

type Ayudantia = {
	closes_at: string;
	course: string;
	message_url: string;
};

function byDate<K>(keyfn: (e: K) => string) {
	return function sorter(a: K, b: K) {
		const a_date = new Date(keyfn(a));
		const b_date = new Date(keyfn(b));
		return a_date.getTime() - b_date.getTime();
	};
}

export default {
	slug: "dccacademic",
	name: "DCCAcademic",
	description: "Backend para el bot DCCAcademic.",
	async ask_meta(ctx, conversation) {
		await ctx.reply("Envía el URL del endpoint de ayudantías");
		const url = await conversation.form.url();
		return { request_url: url.toString() };
	},
	async attach_to_instance(bot, { meta: { request_url } }) {
		await bot.api.setMyCommands([{ command: "ayudantias", description: "Listado de ayudantías" }]);

		bot.command("start", async (ctx) => {
			await ctx.reply("Hola! 👋\nUsa /ayudantias para ver las ayudantías disponibles.");
		});

		bot.command("ayudantias", async (ctx) => {
			try {
				const response = await fetch(request_url);
				const data = await response.json();
				const ayudantias = data.items as Ayudantia[];

				if (ayudantias.length === 0) return await ctx.reply("No hay ayudantías disponibles");

				const a_li = ayudantias.sort(byDate((e) => e.closes_at)).map((a) => {
					const date = new Date(a.closes_at);
					const date_str = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, "0")}`;
					return `\- <b><a href="${a.message_url}">${a.course.trim()}</a></b> [<i>hasta ${date_str}</i>]`;
				});
				// ToDo: ver como no dejar esto tan hard-codeado
				let msg = `<b><u>Ayudantías</u></b>\n${a_li.join("\n")}`;
				msg += "\n\nEl resto de las ayudantías se postula via Siding";
				msg += " o no han partido un proceso de postulación especial aparte aún.\n";
				msg += "Las postulaciones en Siding son desde el 27 de febrero hasta el <b>19 de marzo</b>.\n";
				msg += "PD: Acuérdense de los cursos de ayudantes!";
				await ctx.reply(msg, { parse_mode: "HTML" });
			} catch (error) {
				console.error(error);
				await ctx.reply("Error al obtener ayudantías");
			}
		});
	},
} satisfies BotBuilder<{ request_url: string }>;
