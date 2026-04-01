await Bun.write("players.csv", "");
const csvWriter = Bun.file("players.csv").writer();

const firstLine = "Current Rank,Peak Rank,Peak Season";
csvWriter.write(`${firstLine}\n`);

export async function csv(
	currentRank?: string | undefined,
	peakRank?: string | undefined,
	peakSeason?: string | undefined,
) {
	let line = "";
	if (currentRank && peakRank && peakSeason) {
		line = `${currentRank},${peakRank},${peakSeason}`;
	} else {
		line = "invalid,invalid,invalid";
	}
	csvWriter.write(`${line}\n`);
}
