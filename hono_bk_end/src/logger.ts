import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const LOG_FILE = resolve(process.cwd(), "logs", "patch.log");

export async function logPatchEvent(
	event: string,
	data: Record<string, unknown> = {},
): Promise<void> {
	const line = JSON.stringify({
		time: new Date().toISOString(),
		event,
		...data,
	});

	console.log(line);
	await mkdir(dirname(LOG_FILE), { recursive: true });
	await appendFile(LOG_FILE, `${line}\n`, "utf8");
}
