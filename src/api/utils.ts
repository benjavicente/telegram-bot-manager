import glob from "glob";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function loadModules<DefaultExport>(pattern: string): Promise<DefaultExport[]> {
	return new Promise((resolve, reject) => {
		glob(path.join(__dirname, pattern), (err, files) => {
			if (err) return reject(err);
			const promises = files.map((file) => import(file).then((module) => module.default));
			Promise.all(promises).then(resolve).catch(reject);
		});
	});
}
