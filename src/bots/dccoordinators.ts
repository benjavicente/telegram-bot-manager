import { BotBuilder } from "api/types.js";

type Courses = {
    id: string;
    code: string;
    name: string;
};

type CoursesCoords = {
    id: string;
    name: string;
    rol: string;
    telegram_url: string;
};

function byCode<K>(keyfn: (e: K) => string) {
    return function sorter(a: K, b: K) {
        const a_code = keyfn(a);
        const b_code = keyfn(b);
        return a_code.localeCompare(b_code);
    };
}

export default {
    slug: "dccoordinators",
    name: "DCCoordinators",
    description: "Backend para el bot DCCoordinators.",
    async ask_meta(ctx, conversation) {
        await ctx.reply("Envía el URL del endpoint de coordinadores");
        const url = await conversation.form.url();
        return { request_url: url.toString() };
    },
    async attach_to_instance(bot, { meta: { request_url } }) {
        await bot.api.setMyCommands([{ command: "coordis", description: "Listado de coordinadores" }]);

        bot.command("start", async (ctx) => {
            await ctx.reply("Hola! 👋\nUsa /coordis para ver los coordinadores de los cursos del DCC.");
        });

        bot.command("coordis", async (ctx) => {
            try {
                // TODO: request_url
                const responseCourses = await fetch(request_url);
                const dataCourses = await responseCourses.json();
                const courses = dataCourses.items as Courses[];

                // TODO: request_url
                const responseCoursesCoords = await fetch(request_url);
                const dataCoursesCoords = await responseCoursesCoords.json();
                const coursesCoords = dataCoursesCoords.items as CoursesCoords[];

                if (courses.length === 0) return await ctx.reply("No hay ramos");
                if (coursesCoords.length === 0) return await ctx.reply("No hay coordinadores");

                // MATCH BEETWEEN courses AND coursesCoords
                const info = courses.sort(byCode((e) => e.code)).map((course) => {
                    // Have coursesCoords for the course
                    const coords:CoursesCoords[] = coursesCoords.filter((coordis) => coordis.id === course.id);
                    
                    let textArray = [`\- <b>${course.code} - ${course.code}</b>`];
                    if (coords) {
                        textArray.push(...coords.map((coord) => {
                            if (coord.name) {
                                return ` * ${coord.rol}: <a href="${coord.telegram_url}">${coord.name}</a>`;
                            } else {
                                return ` * ${coord.rol}: No Definido`;
                            }
                        }));
                    }
                    return textArray;
                });
                
                let msg = `<b><u>Coordinadores</u></b>\n${info.join("\n")}`;
                msg += "\n\nSi faltan coordis que conozcas envia un mensaje a ";
                msg += `<a href="https://t.me/ImTheRealTony">acá</a>.`;
                await ctx.reply(msg, { parse_mode: "HTML" });
            } catch (error) {
                console.error(error);
                await ctx.reply("Error al obtener coordinadores");
            }
        });
    },
} satisfies BotBuilder<{ request_url: string }>;
