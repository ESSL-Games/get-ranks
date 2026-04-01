import { ranks } from "./constants.ts";
import { log } from "./lib/log.ts";
import { type ISeason, Valorant } from "./lib/valorant.ts";

const namesFile = Bun.file("names.txt");
const namesText = await namesFile.text();
const namesList = namesText.split("\n");

const teamsFile = Bun.file("teams.txt");
const teamsText = await teamsFile.text();
const teamsList = teamsText.split("\n");

const valorant = await Valorant.create();

for (let i = 0; i < namesList.length; i++) {
	const player = namesList[i];
	if (player) {
		const nameSplit = player.split("#");
		if (teamsList[i - 1] !== teamsList[i]) {
			await log(teamsList[i]);
		}
		await log(`   ${player}`);
		if (nameSplit.length === 2) {
			const name = nameSplit[0];
			const tag = nameSplit[1];
			if (name && tag) {
				const rank = await valorant.fetchMmr(name, tag);
				if (rank) {
					if ("currentRank" in rank) {
						await log(`      ${ranks[rank.currentRank]}`);
						const seasonsAw = await valorant.seasons;

						const actSeason = seasonsAw.find(
							(seasons) => seasons.ID === rank.maxSeason,
						);

						const actStartDate = new Date(actSeason?.StartTime || "");
						const actEndDate = new Date(actSeason?.EndTime || "");

						let episodeSeason: ISeason = {
							ID: "",
							Name: "",
							Type: "episode",
							StartTime: "",
							EndTime: "",
							IsActive: false,
						};

						for (const epi of seasonsAw) {
							const epiStartDate = new Date(epi.StartTime);
							const epiEndDate = new Date(epi.EndTime);

							if (
								epi.Type === "episode" &&
								epiStartDate.getTime() <= actStartDate.getTime() &&
								actEndDate.getTime() <= epiEndDate.getTime()
							) {
								episodeSeason = epi;
								break;
							}
						}

						const episode = episodeSeason?.Name;
						const act = actSeason?.Name;

						await log(`      ${ranks[rank.maxRank]} (${episode} // ${act})`);
					} else {
						if (rank.playerDoesNotExist) {
							await log("      Account doesn't Exists");
						}
						if (rank.playerNeverPlayedRanked) {
							await log("      Player never played comp or is not eligible");
						}
					}
				}
			}
		} else {
			await log("      invalid Valorant Name");
		}
	}
}
