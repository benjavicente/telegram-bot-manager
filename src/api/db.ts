import PocketBase from "pocketbase";

export const db = new PocketBase(process.env.DB_URL || "http://127.0.0.1:8090");

export async function dbHealthCheck() {
	try {
		const response = await db.health.check();
		if (response.code !== 200) throw response.message;
	} catch {
		throw new Error("Database is not healthy");
	}
}
