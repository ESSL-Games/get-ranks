await Bun.write("players.log", "");
const logWriter = Bun.file("players.log").writer();

export async function log(text: string | undefined) {
	const line = text ?? "";
	logWriter.write(`${line}\n`);
	console.log(line);
}
