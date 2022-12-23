import Koa from "koa";
import Router from "@koa/router";
import bodyparser from "koa-bodyparser";

import { db, manager } from "./api/index.js";

const app = new Koa();
const router = new Router();

app.use(async (ctx, next) => {
	const initial_time = Date.now();
	await next();
	const final_time = Date.now();
	console.log(`[${ctx.status}] ${ctx.method} ${ctx.url} - ${final_time - initial_time}ms`);
});

router
	.post("/", async (ctx) => {
		const bot = manager.bot;
		ctx.body = "";
		await bot.handleUpdate(ctx.request.body as any);
	})
	.post("/temp/:bot_id", async (ctx) => {
		ctx.body = "";
		const fn = manager.temp_bots_handlers[ctx.params.bot_id];
		if (!fn) return ctx.throw(404);
		fn(ctx.request.body as any);
	})
	.post("/:bot_id", async (ctx) => {
		try {
			await manager.handleManagedBotUpdate(Number(ctx.params.bot_id), ctx.request.body as any);
		} catch {
			return ctx.throw(404);
		} finally {
			ctx.body = "";
		}
	});

await manager.init();
app.use(bodyparser());
app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000);
