export interface User {
    [key: string]: any;
    uid: string,
    user_name: string,
    isAdmin: boolean,
    first_name: string,
    last_name: string,
    picture: string,
    email: string,
    league_id: string,
    notification_count: number,
    team_managed: string,
    log_in_date: string,
    log_in_time: string,
    log_out_date: string,
    log_out_time: string
};

export interface League {
    [key: string]: any;
    league_id: string,
    league_name: string,
    current_season: number,
    picture: string,
    commissioner_id: string,
    commissioner: string,
    salary_cap: number,
    max_roster_size: number, 
    rookie_bank_size: number,
    min_forwards: number,
    min_defense: number,
    min_goalies: number,
    ir_slots: number,
    retention_slots: number,
    max_retention_perc: number,
    general_draft_length: number,
    rookie_draft_length: number,
    protection_sheet_limit: number,
    drafts: Draft[];
};

export interface Team {
    [key: string]: any; 
    team_id: string,
    league_id: string,
    team_name: string,
    managed_by: string,
    managers: User[],
    picture: string,
    seasons: Season[],
    total_points: number,
    roster_size: number,
    total_cap: number,
    cap_space: number,
    roster: Player[],
    forwards: Player[],
    num_forwards: number,
    forward_salary: number,
    defense: Player[],
    num_defense: number,
    defense_salary: number,
    goalies: Player[],
    num_goalies: number,
    goalie_salary: number,
    injured_reserve: Player[],
    ir_count: number,
    ir_salary: number,
    rookie_bank: Player[],
    rookie_count: number,
    salary_retained: number,
    player_retained: string | null,
    trade_block: Player[],
    draft_picks: Draft_Pick[],
    fa_picks: FA_Pick[],
    inbox: Trade[]
};

export interface Player {
    [key: string]: any; 
    player_id: string,
    first_name: string,
    last_name: string,
    short_code: string,
    logo: string,
    position: string,
    isRookie: boolean,
    onIR: boolean,
    onTradeBlock: boolean,
    onBench: boolean,
    isFranchise: boolean,
    contract_status: string,
    contract_end: string,
    expiry_status: string, 
    years_left_current: number,
    aav_current: number,
    years_left_next: number,
    aav_next: number,
    owned_by: string,
    retention_perc: number,
    last_updated: Date,
    updated_by: string,
};

export interface Draft {
    [key: string]: any;
    draft_id: number,
    year: number,
    type: string,
    status: string,
    draft_order: Team[],
}

export interface Draft_Pick {
    [key: string]: any;
    asset_id: number,
    assigned_to: string,
    owned_by: string,
	league_id: number,
    year: number,
    round: number,
    position: number,
    pick_number: number,
    type: string,
    player_taken: string,
    player_first_name: string, 
    player_last_name: string,
    player_full_name: string, 
    player_position: string,
    player_short_code: string,
    draft_id: number,
    pick_history: Pick_History[];
}

export interface FA_Pick {
    [key: string]: any;
    asset_id: number,
    assigned_to: string,
    owned_by: string,
	league_id: number,
    year: number,
    week: number,
    expiry_date: Date,
    player_taken: string,
    player_first_name: string,
    player_last_name: string,
    player_full_name: string,
    pick_history: Pick_History[];
}

export interface Pick_History {
    traded_to: string;
    date: Date;
}

export type Asset = (Player | Draft_Pick | FA_Pick) & {
  traded_to?: string | null;
  traded_from?: string | null; 
  asset_type?: 'player' | 'draft_pick' | 'fa';
  trade_id?: string | null;
} | null;

export interface Trade {
    [key: string]: any;
    trade_id: string,
    league_id: number,
    requested_by: string,
    sent_to: string,
    status: string,
    assets: Asset[],
    conditions: Trade_Condition[]
}

export interface Trade_Condition {
    [key: string]: any;
    condition_id: string,
    trade_id: string,
    description: string,
    status: string,
    league_id: number,
    requested_by: string,
    sent_to: string,
    date: Date
}

export interface NHL_Team {
    [key: string]: any;
    short_code: string,
    city: string,
    team_name: string,
    logo: string,
}

export interface Activity {
    [key: string]: any;
    league_id: string,
    message: string,
    action_type: string,
    date: string,
    time: string,
    user_id: string,
    trade_id: string,
}

export interface Season {
    [key: string]: any;
    team_id: string,
    league_id: number,
    season: string,
    start_year: number,
    end_year: number,
    playoffs: boolean,
    points: number,
}

export interface Log {
    success: boolean,
    totalProcessed: number,
    updates: number,
    creates: number,
    rows: Log_Row[],
    errors: number
}

export interface Log_Row {
    status: string,
    player: string,
    years: number,
    salary: number,
    team: string,
    position: string
}