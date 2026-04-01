import { before_ascendant_seasons } from "../constants.ts";

export class Valorant {
	private constructor(
		private readonly lockfile: ILockfile,
		private readonly region: string,
		private readonly pd_url: string,
		private readonly glz_url: string,
	) {
		this.headers = this.getHeaders();
	}

	static async create(): Promise<Valorant> {
		const lockfile = await Valorant.get_lockfile();
		return new Valorant(
			lockfile,
			"eu",
			"https://pd.eu.a.pvp.net",
			"https://glz-eu.eu.a.pvp.net",
		);
	}
	puuid = "";

	headers: Promise<Headers>;
	currentSeason = "9d85c932-4820-c060-09c3-668636d4df1b";

	seasons = this.getSeasons();

	private async getSeasons(): Promise<ISeason[]> {
		await Bun.sleep(1000); // Raul muss kurz Mittagsschläfen machen
		const request = await fetch(
			"https://shared.eu.a.pvp.net/content-service/v3/content",
			{
				method: "GET",
				headers: await this.headers,
			},
		);
		const data = (await request.json()) as { Seasons: ISeason[] };
		return data.Seasons as ISeason[];
	}

	private static async get_lockfile(): Promise<ILockfile> {
		const valorantLockfilePath = `${Bun.env.LOCALAPPDATA}\\Riot Games\\Riot Client\\Config\\lockfile`;
		const valorantLockfile = Bun.file(valorantLockfilePath);

		try {
			const lockfileText = await valorantLockfile.text();
			const [name, PID, port, password, protocol] = lockfileText
				.trim()
				.split(":");

			if (!name || !PID || !port || !password || !protocol) {
				console.log("Valorant lockfile is malformed");
				process.exit(1);
			}

			return { name, PID, port, password, protocol };
		} catch {
			console.log("Valorant is not running");
			process.exit(1);
		}
	}

	private async get_current_version(): Promise<string | undefined> {
		const path = `${Bun.env.LOCALAPPDATA}\\VALORANT\\Saved\\Logs\\ShooterGame.log`;
		const text = await Bun.file(path).text();

		for (const line of text.split(/\r?\n/)) {
			if (line.includes("CI server version:")) {
				const versionWithoutShipping = line
					.split("CI server version: ")[1]
					?.trim();
				if (!versionWithoutShipping) {
					break;
				}

				return versionWithoutShipping.split("-").join("-");
			}
		}
	}

	private async getHeaders(): Promise<Headers> {
		let entitlements: EntitlementsResponse = {};

		const url = `https://127.0.0.1:${this.lockfile.port}/entitlements/v1/token`;

		const localHeaders = {
			Authorization: `Basic ${Buffer.from(`riot:${this.lockfile.password}`).toString("base64")}`,
		};

		const response = await fetch(url, {
			method: "GET",
			headers: localHeaders,
			tls: { rejectUnauthorized: false },
		});

		entitlements = (await response.json()) as EntitlementsResponse;

		this.puuid = entitlements.subject ?? "";

		const headers = new Headers({
			Authorization: `Bearer ${entitlements.accessToken ?? ""}`,
			"X-Riot-Entitlements-JWT": entitlements.token ?? "",
			"X-Riot-ClientPlatform":
				"ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9",
			"User-Agent": "ShooterGame/13 Windows/10.0.19043.1.256.64bit",
		});

		const clientVersion = await this.get_current_version();
		if (clientVersion) {
			headers.set("X-Riot-ClientVersion", clientVersion);
		}

		return headers;
	}

	async fetchMmr(
		name: string,
		tag: string,
	): Promise<
		| { currentRank: number; maxRank: number; maxSeason: string }
		| { playerDoesNotExist: boolean; playerNeverPlayedRanked: boolean }
	> {
		const localHeaders = {
			Authorization: `Basic ${Buffer.from(`riot:${this.lockfile.password}`).toString("base64")}`,
		};

		let playerDoesNotExist = false;
		let playerNeverPlayedRanked = false;

		let lookupStatus = false;

		let lookup: ILookupResponse[] = [];

		while (!lookupStatus) {
			const lookupResponse = await fetch(
				`https://127.0.0.1:${this.lockfile.port}/player-account/aliases/v1/lookup?gameName=${name}&tagLine=${tag} `,
				{
					method: "GET",
					headers: localHeaders,
					tls: { rejectUnauthorized: false },
				},
			);
			lookup = (await lookupResponse.json()) as ILookupResponse[];
			if (lookupResponse.status === 429) {
				lookupStatus = false;
				await Bun.sleep(1000); // Raul schlafen gehen
			}
			if (lookupResponse.ok) {
				lookupStatus = true;
			}
			if (lookup.length === 0) playerDoesNotExist = true;
		}
		if (lookup.length > 0 && !playerDoesNotExist) {
			if (lookup[0]) {
				let mmrStatus = false;
				while (!mmrStatus) {
					const mmrResponce = await fetch(
						`${this.pd_url}/mmr/v1/players/${lookup[0].puuid}`,
						{
							method: "GET",
							headers: await this.headers,
						},
					);
					if (mmrResponce.ok) {
						mmrStatus = true;
						const mmr = await mmrResponce.json();
						let maxRank = 0;
						let maxSeason = "";
						for (const season in mmr.QueueSkills.competitive
							.SeasonalInfoBySeasonID) {
							const s =
								mmr.QueueSkills.competitive.SeasonalInfoBySeasonID[season];
							if (s.CompetitiveTier >= maxRank) {
								maxRank = s.CompetitiveTier;
								maxSeason = s.SeasonID;
								if (
									before_ascendant_seasons.includes(s.SeasonID) &&
									s.CompetitiveTier >= 21
								) {
									maxRank = s.CompetitiveTier + 3;
								}
							}
						}
						if (mmr.QueueSkills.competitive.SeasonalInfoBySeasonID !== null) {
							if (
								mmr.QueueSkills.competitive.SeasonalInfoBySeasonID[
									this.currentSeason
								]
							) {
								return {
									currentRank:
										mmr.QueueSkills.competitive.SeasonalInfoBySeasonID[
											this.currentSeason
										].CompetitiveTier,
									maxRank,
									maxSeason,
								};
							}
							return {
								currentRank: 0,
								maxRank,
								maxSeason,
							};
						}
						playerNeverPlayedRanked = true;
						return { playerDoesNotExist, playerNeverPlayedRanked };
					}
					if (mmrResponce.status === 429) {
						mmrStatus = false;
						await Bun.sleep(1000); // Raul schlafen gehen
					}
				}
			}
		} else {
			return { playerDoesNotExist, playerNeverPlayedRanked };
		}
		return { playerDoesNotExist, playerNeverPlayedRanked };
	}
}

interface ILockfile {
	name: string;
	PID: string;
	port: string;
	password: string;
	protocol: string;
}

interface EntitlementsResponse {
	accessToken?: string;
	token?: string;
	subject?: string;
	message?: string;
}

interface ILookupResponse {
	alias: { game_name: string; tag_line: string };
	puuid: string;
}

export interface ISeason {
	ID: string;
	Name: string;
	Type: "episode" | "act";
	StartTime: string;
	EndTime: string;
	IsActive: boolean;
}
