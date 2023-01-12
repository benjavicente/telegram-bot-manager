import { BotBuilder } from "api/types.js";

type Courses = {
    id: string;
    code: string;
    name: string;
};

type CoursesCoords = {
    id: string;
    course_id: string;
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
    async attach_to_instance(bot, { meta: { request_url } }) {
        const { COURSES_ENDPOINT, COURSES_COORD_ENDPOINT } = process.env;

        if (!COURSES_ENDPOINT) throw new Error("COURSES_ENDPOINT not set");
        if (!COURSES_COORD_ENDPOINT) throw new Error("COURSES_COORD_ENDPOINT not set");
        console.log("COURSES_ENDPOINT", COURSES_ENDPOINT);
        console.log("COURSES_COORD_ENDPOINT", COURSES_COORD_ENDPOINT);

        await bot.api.setMyCommands([{ command: "coordis", description: "Listado de coordinadores" }]);

        bot.command("start", async (ctx) => {
            await ctx.reply("Hola! 👋\nUsa /coordis para ver los coordinadores de los cursos del DCC.");
        });

        bot.command("coordis", async (ctx) => {
            try {
                // TODO: request_url
                const responseCourses = await fetch(COURSES_ENDPOINT);
                const dataCourses = await responseCourses.json();
                const courses = dataCourses.items as Courses[];

                // TODO: request_url
                const responseCoursesCoords = await fetch(COURSES_COORD_ENDPOINT);
                const dataCoursesCoords = await responseCoursesCoords.json();
                const coursesCoords = dataCoursesCoords.items as CoursesCoords[];

                if (courses.length === 0) return await ctx.reply("No hay ramos");
                if (coursesCoords.length === 0) return await ctx.reply("No hay coordinadores");

                // MATCH BEETWEEN courses AND coursesCoords
                const info = courses.sort(byCode((e) => e.code)).map((course) => {
                    // Have coursesCoords for the course
                    const coords: CoursesCoords[] = coursesCoords.filter((coordis) => coordis.course_id === course.id);
                    
                    // console.log("COORDS", coords);
                    const textArray = [`\<b>${course.code} ${course.name}</b>`];
                    if (coords) {
                        textArray.push(...coords.map((coord) => {
                            if (coord.name) {
                                return `- ${coord.rol}: <a href="${coord.telegram_url}">${coord.name}</a>`;
                            } else {
                                return `- ${coord.rol}: No Definido`;
                            }
                        }));
                    }
                    // console.log("TEXTARRAY", textArray);
                    return textArray.join("\n");
                });
                // console.log("INFO", info);
                
                let msg = `<b><u>Coordinadores</u></b>\n\n${info.join("\n\n")}`;
                // console.log("MSG", msg);
                msg += "\n\nSi faltan coordis que conozcas envia un mensaje a ";
                msg += `<a href="https://t.me/ImTheRealTony">acá</a>.`;
                await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true });
            } catch (error) {
                console.error(error);
                await ctx.reply("Error al obtener coordinadores");
            }
        });
    },
} satisfies BotBuilder<{ request_url: string }>;
