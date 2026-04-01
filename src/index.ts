import type { HenrikMmrResponse } from "./types.ts";

await Bun.write("log.log", "");
const logWriter = Bun.file("log.log").writer({ append: true });

const namesFile = Bun.file("names.txt");
const namesText = await namesFile.text();
const namesList = namesText.split("\n");

const teamsFile = Bun.file("teams.txt");
const teamsText = await teamsFile.text();
const teamsList = teamsText.split("\n");

for (let i = 0; i < namesList.length; i++) {
	let status = false;
	let tries = 0;
	while (!status) {
		status = await fetchMmr(i, tries);
		if (!status) {
			tries++;
		}
		if (tries > 0) {
			await Bun.sleep(3000);
		}
	}
}

await logWriter.flush();
logWriter.end();

async function fetchMmr(i: number, tries: number) {
	if (namesList[i]) {
		const nameSplit = namesList[i].split("#");
		if (tries === 0) {
			if (teamsList[i - 1] !== teamsList[i]) {
				await log(teamsList[i]);
			}
			await log(`   ${namesList[i]}`);
		}
		if (nameSplit.length === 2) {
			const name = nameSplit[0];
			const tag = nameSplit[1];

			if (name && tag) {
				const response = await fetch(
					`https://api.henrikdev.xyz/valorant/v3/mmr/eu/pc/${name.trim()}/${tag}`,
					{
						method: "GET",
						headers: {
							Authorization: Bun.env.HENRIK_API_KEY || "",
							Accept: "*/*",
						},
					},
				);

				if (!response.ok) {
					const accountResponse = await fetch(
						`https://api.henrikdev.xyz/valorant/v1/account/${name}/${tag}`,
						{
							method: "GET",
							headers: {
								Authorization: Bun.env.HENRIK_API_KEY || "",
								Accept: "*/*",
							},
						},
					);

					if (accountResponse.ok) {
						await log("      Account Exists, but not played ranked / eligible");
					} else {
						if (
							accountResponse.status !== 200 &&
							accountResponse.status !== 404
						) {
							return false;
						}
						await log("      Account doesn't Exists");
					}
				}

				const responseData: HenrikMmrResponse =
					(await response.json()) as HenrikMmrResponse;
				if (responseData.data) {
					await log(
						`      Current: ${responseData.data.current?.tier.name ?? "Unranked"} ${responseData.data.current?.rr ?? ""}`,
					);
					await log(
						`      Peak: ${responseData.data.peak?.tier.name ?? "N/A"} ${responseData.data.peak?.season.short ?? ""}`,
					);
				}
			}
		} else {
			await log("      invalid Valorant Name");
		}
	}
	return true;
}

async function log(text: string | undefined) {
	const line = text ?? "";
	logWriter.write(`${line}\n`);
	console.log(line);
}
