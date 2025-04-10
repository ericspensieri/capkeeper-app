import { Injectable } from '@angular/core';
import { TeamService } from '@app/services/team.service';
import { GlobalService } from '@app/services/global.service';
import { Team, Player, Draft_Pick, Asset } from '@app/types';

@Injectable({
  providedIn: 'root'
})
export class TradeService {
  teams: Team[] = [];
  league_id!: string;
  salary_cap: number = 0;
  team1!: Team;
  team1_contracts!: number;
  team1_rookies!: number;
  team1_salary!: number;
  team1_retention_slots!: number;
  team2!: Team;
  team2_contracts!: number;
  team2_rookies!: number;
  team2_salary!: number;
  team2_retention_slots!: number;
  team1_assets: Asset[] = Array(6).fill(null);
  team1_assets_types: string[] = Array(6).fill('');
  team2_assets: Asset[] = Array(6).fill(null);
  team2_assets_types: string[] = Array(6).fill('');
  trade_conditions: string[] = [];
  dropdownOpenReq: boolean[] = Array(6).fill(false);
  dropdownOpenRec: boolean[] = Array(6).fill(false);  
  selected_player!: Player;
  selected_team!: Team;

  constructor(
    protected teamService: TeamService,
    public globalService: GlobalService,
  ) { }

  setteam1(team_id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.teamService.getRosterByTeam(this.league_id, team_id).subscribe(
        response => {
          this.team1 = response.team;

          this.team1.roster_size = response.roster.length;
          this.team1.total_cap = this.getTotalCap(response.roster) + this.team1.salary_retained;
          this.team1_retention_slots = this.countRetentionSlots(response.roster);

          this.team1.roster = this.clearSalaryRetention(response.roster);
          this.team1.draft_picks = response.draft_picks;
          this.team1.fa_picks = response.fa_picks.filter(pick => pick.owned_by === this.team1.team_id && !pick.player_taken);
  
          if (this.globalService.league) {
            this.salary_cap = this.globalService.league.salary_cap;
            this.team1.cap_space = this.salary_cap - this.team1.total_cap;
          }
  
          this.team1.rookie_count = this.countRookies(this.team1.roster);
          this.team1_contracts = this.team1.roster_size - this.team1_rookies;
          this.team1_salary = this.team1.total_cap;
          
          this.clearAssets('team1');
          this.teams[0] = this.team1;

          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }
  
  setteam2(team_id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.team2_assets = Array(6).fill(null);
      this.team2_assets_types = Array(6).fill('');
  
      this.teamService.getRosterByTeam(this.league_id, team_id).subscribe(
        response => {
          this.team2 = response.team;

          this.team2.roster_size = response.roster.length;
          this.team2.total_cap = this.getTotalCap(response.roster) + this.team2.salary_retained;
          this.team2_retention_slots = this.countRetentionSlots(response.roster);

          this.team2.roster = this.clearSalaryRetention(response.roster);
          this.team2.draft_picks = response.draft_picks;
          this.team2.fa_picks = response.fa_picks.filter(pick => pick.owned_by === this.team2.team_id && !pick.player_taken);
  
          if (this.globalService.league) {
            this.team2.cap_space = this.globalService.league.salary_cap - this.team2.total_cap;
          }
  
          this.team2.rookie_count = this.countRookies(this.team2.roster);
          this.team2_contracts = this.team2.roster_size - this.team2_rookies;
          this.team2_salary = this.team2.total_cap;

          this.clearAssets('team2');
          this.teams[1] = this.team2;

          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  getTotalCap(roster: Player[]): number {
    let sum = 0
    for (let player of roster) {
      if (!player.isRookie && !player.onIR) {
        if (player.retention_perc && player.retention_perc > 0) {
          sum += player.aav_current * (1 - (player.retention_perc / 100))
        }
        else{
          sum += player.aav_current;
        }
      }
    }
    return sum;
  }

  capSpaceAfterTrade(index: number): number {
    const myTeam = index === 0 ? this.team1 : this.team2;
    const myAssets = index === 0 ? this.team1_assets : this.team2_assets;
    const opposingAssets = index === 0 ? this.team2_assets : this.team1_assets;
    
    let capSpace = myTeam.cap_space;
    for (let asset of myAssets) {
      if (asset && asset.aav_current > 0) {
        capSpace += asset.aav_current;
      }
    }
    for (let asset of opposingAssets) {
      if (asset && asset.aav_current > 0) {
        capSpace -= asset.aav_current;
      }
    }
    return capSpace;
  }

  contractsAfterTrade(index: number): number {
    const myTeam = index === 0 ? this.team1 : this.team2;
    const myAssets = index === 0 ? this.team1_assets : this.team2_assets;
    const opposingAssets = index === 0 ? this.team2_assets : this.team1_assets;
    
    let contracts = myTeam.roster_size - myTeam.rookie_count;
    for (let asset of myAssets) {
      if (asset && asset.player_id && !asset.isRookie) {
        contracts--;
      }
    }
    for (let asset of opposingAssets) {
      if (asset && asset.player_id && !asset.isRookie) {
        contracts++;
      }
    }
    return contracts;
  }

  rookiesAfterTrade(index: number): number {
    const myTeam = index === 0 ? this.team1 : this.team2;
    const myAssets = index === 0 ? this.team1_assets : this.team2_assets;
    const opposingAssets = index === 0 ? this.team2_assets : this.team1_assets;
    
    let rookies = myTeam.rookie_count;
    for (let asset of myAssets) {
      if (asset && asset.player_id && asset.isRookie) {
        rookies--;
      }
    }
    for (let asset of opposingAssets) {
      if (asset && asset.player_id && asset.isRookie) {
        rookies++;
      }
    }
    return rookies;
  }

  getPicksByType(team: Team, type: string): Draft_Pick[] {
    let pickArray = team.draft_picks.filter(pick => pick.type === type);

    pickArray.sort((a, b) => {
        if (a.year !== b.year) {
            return a.year - b.year;
        }
        if (a.round !== b.round) {
            return a.round - b.round;
        }
        if (a.pick_number && b.pick_number) {
            return a.pick_number - b.pick_number;
        }
        return 0;
    });

    return pickArray;
  }

  countRookies(roster: Player[]): number {
    let count = 0;
    for (let player of roster) {
      if (player.isRookie) {
        ++count;
      }
    }
    return count;
  }

  closeOpenDropdowns(): void {
    for (let bool of this.dropdownOpenReq) {
      if (bool) { bool = !bool } 
    }
    for (let bool of this.dropdownOpenRec) {
      if (bool) { bool = !bool } 
    }
  }

  toggleReqDropdown(index: number): void {
    this.dropdownOpenReq[index] = !this.dropdownOpenReq[index];
  }

  toggleRecDropdown(index: number): void {
    this.dropdownOpenRec[index] = !this.dropdownOpenRec[index];
  }

  closeReqDropdown(index: number): void {
    this.dropdownOpenReq[index] = false;
  }

  closeRecDropdown(index: number): void {
    this.dropdownOpenRec[index] = false;
  }

  selectAsset(array: Asset[], asset: Asset, index: number) {
    array[index] = asset;
    if (this.getAssetType(asset) === 'player') {
      this.adjustSalaries();
    }
    this.dropdownOpenReq[index] = false;
  }

  removeAsset(array: Asset[], index: number): void {
    let asset = array[index];
    array[index] = null;
    if (this.getAssetType(asset) === 'player') {
      if (asset && asset.retention_perc > 0) {
        asset.retention_perc = 0;
        this.removeRetention(asset.player_id);
      } 
      this.adjustSalaries();
    }
  }

  clearAssets(team: string): void {
    if (team === 'team1') {
      this.team1_assets = Array(6).fill(null);
      this.team1_assets_types = Array(6).fill('');
    }
    if (team === 'team2') {
      this.team2_assets = Array(6).fill(null);
      this.team2_assets_types = Array(6).fill('');
    }
    this.resetAdjustments();
    return;
  }

  clearSalaryRetention(roster: Player[]): Player[] {
    for (let player of roster) {
      if (player.retention_perc > 0) {
        player.retention_perc = 0;
      }
    }
    return roster;
  }

  showRetentionPerc(retention_perc: number): string {
    if (retention_perc === null) {
      return '0%';
    }
    return retention_perc + '%';
  }

  getAssetType(asset: Asset): string {
    if (asset) {
      if ('player_id' in asset) {
        return 'player';
      }
      if ('type' in asset) {
        return'draft_pick'
      }
      if ('week' in asset) {
        return 'fa'
      }
    }
    return '';
  }
  
  setSalaryRet(player: Player): void {
    for (let asset of this.team1_assets) {
      if (asset?.player_id === player.player_id) {
        asset.retention_perc = player.retention_perc;
        return;
      }
    }
    for (let asset of this.team2_assets) {
      if (asset?.player_id === player.player_id) {
        asset.retention_perc = player.retention_perc;
        return;
      }
    }
  }

  removeRetention(player_id: string): void {
    if (this.team1.player_retained === player_id) {
      this.team1.player_retained = null;
      this.team1.salary_retained = 0;
    }
    if (this.team2.player_retained === player_id) {
      this.team2.player_retained = null;
      this.team2.salary_retained = 0;
    }
  }

  countRetentionSlots(roster: Player[]): number {
    let count = 0;
    for (let player of roster) {
      if (player.retention_perc > 0) {
        ++count;
      }
    }
    return count;
  }

  incrementSalaryRet(player: Player): number {
    if (!player.retention_perc) {
      player.retention_perc = 0;
    }
    player.retention_perc += 5
    return player.retention_perc;
  }

  decrementSalaryRet(player: Player): number {
    if (!player.retention_perc) {
      player.retention_perc = 0
    }
    else {
      player.retention_perc -= 5;
    }
    return player.retention_perc;
  }

  resetAdjustments(): void {
    this.team1_rookies = this.countRookies(this.team1.roster);
    this.team1_contracts = this.team1.roster_size - this.team1_rookies;
    this.team1_salary = this.team1.total_cap;

    this.team2_rookies = this.countRookies(this.team2.roster);
    this.team2_contracts = this.team2.roster_size - this.team2_rookies;
    this.team2_salary = this.team2.total_cap;
  }

  adjustSalaries(): void {
    this.resetAdjustments();

    for (let asset of this.team1_assets) {
      if (asset && this.getAssetType(asset) === 'player') {
        if (asset.isRookie) {
          this.team2_rookies++;
          this.team1_rookies--;
        }
        else {
          this.team2_contracts++;
          this.team2_salary += asset.aav_current - (asset.aav_current * (asset.retention_perc / 100));
          this.team1_contracts--;
          this.team1_salary -= asset.aav_current - (asset.aav_current * (asset.retention_perc / 100));
        }
      }
    }

    for (let asset of this.team2_assets) {
      if (asset && this.getAssetType(asset) === 'player') {
        if (asset.isRookie) {
          this.team1_rookies++;
          this.team2_rookies--;
        }
        else {
          this.team1_contracts++;
          this.team1_salary += asset.aav_current - (asset.aav_current * (asset.retention_perc / 100));
          this.team2_contracts--;
          this.team2_salary -= asset.aav_current - (asset.aav_current * (asset.retention_perc / 100));
        }
      }
    }
  }

  rosterIsValid(roster: number): boolean {
    if (this.globalService.league) {
      return roster <= this.globalService.league?.max_roster_size;
    }
    return roster <= 30
  }

  rookieIsValid(rookies: number): boolean {
    if (this.globalService.league) {
      return rookies <= this.globalService.league.rookie_bank_size;
    }
    return rookies <= 10;
  }

  salaryIsValid(salary: number): boolean {
    return salary < this.salary_cap;
  }

  tradeIsValid(): boolean {
    return (this.rosterIsValid(this.team1_contracts) && this.rookieIsValid(this.team1_rookies) && this.salaryIsValid(this.team1_salary)
            && this.rosterIsValid(this.team2_contracts) && this.rookieIsValid(this.team2_rookies) && this.salaryIsValid(this.team2_salary)
          )
  }

}
