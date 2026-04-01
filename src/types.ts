export type IMmrData = {
	current?: {
		tier: {
			id: number;
			name: string;
		};
		rr: number;
		last_change: number;
		elo: number;
		games_needed_for_rating: number;
		rank_protection_shields: number;
		leaderboard_placement: number | null;
	};
	peak?: {
		season: {
			id: string;
			short: string;
		};
		ranking_schema: string;
		tier: {
			id: number;
			name: string;
		};
		rr: number;
	};
};

export type HenrikMmrResponse = {
	data: IMmrData;
};
