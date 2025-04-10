import { Component, TemplateRef} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GlobalService } from '@app/services/global.service';
import { TeamService } from '@app/services/team.service';
import { ToastService } from '@app/services/toast-service.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Team, Player, Draft_Pick, Asset } from '@app/types';

@Component({
  selector: 'app-trade-proposal',
  templateUrl: './trade-proposal.component.html',
  styleUrl: './trade-proposal.component.css',
  standalone: false
})

export class TradeProposalComponent {
  teams: Team[] = [];
  league_id!: string;
  salary_cap: number = 0;
  requestor!: Team;
  requestor_contracts!: number;
  requestor_rookies!: number;
  requestor_salary!: number;
  requestor_retention_slots!: number;
  recipient!: Team;
  recipient_contracts!: number;
  recipient_rookies!: number;
  recipient_salary!: number;
  recipient_retention_slots!: number;
  assets_given: Asset[] = Array(6).fill(null);
  assets_given_types: string[] = Array(6).fill('');
  assets_received: Asset[] = Array(6).fill(null);
  assets_received_types: string[] = Array(6).fill('');
  trade_conditions: string[] = [];
  dropdownOpenReq: boolean[] = Array(6).fill(false);
  dropdownOpenRec: boolean[] = Array(6).fill(false);  
  toastMessage: string = '';
  modalRef!: BsModalRef;
  selected_player!: Player;
  selected_team!: Team;

  constructor(
    protected teamService: TeamService,
    public globalService: GlobalService,
    protected modalService: BsModalService,
    protected toastService: ToastService,
    protected route: ActivatedRoute,
    protected http: HttpClient,
    protected router: Router,
  ) { }

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(async (params) => {
      this.league_id = params.get('league_id')!;
  
      if (!this.globalService.loggedInTeam) {
        try {
          await this.globalService.initializeLeague(this.league_id, this.router.url);
        } catch (error) {
          console.error("Error during league initialization:", error);
          return;
        }
      }
  
      if (this.globalService.loggedInTeam) {
        this.teams = this.globalService.teams.filter(
          (team) => team.team_id !== this.globalService.loggedInTeam?.team_id
        );
        this.setRequestor(this.globalService.loggedInTeam.team_id);
      }
  
      this.route.queryParamMap.subscribe((queryParams) => {
        const recipient_id = queryParams.get('team');
        if (recipient_id) {
          this.setRecipient(recipient_id);
        }
      });
    });
  }
  
  setRequestor(team_id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.teamService.getRosterByTeam(this.league_id, team_id).subscribe(
        response => {
          this.requestor = response.team;

          this.requestor.roster_size = response.roster.length;
          this.requestor.total_cap = this.getTotalCap(response.roster) + this.requestor.salary_retained;
          this.requestor_retention_slots = this.countRetentionSlots(response.roster);

          this.requestor.roster = this.clearSalaryRetention(response.roster);
          this.requestor.draft_picks = response.draft_picks;
          this.requestor.fa_picks = response.fa_picks.filter(pick => pick.owned_by === this.requestor.team_id && !pick.player_taken);
  
          if (this.globalService.league) {
            this.salary_cap = this.globalService.league.salary_cap;
            this.requestor.cap_space = this.salary_cap - this.requestor.total_cap;
          }
  
          this.requestor_rookies = this.countRookies(this.requestor.roster);
          this.requestor_contracts = this.requestor.roster_size - this.requestor_rookies;
          this.requestor_salary = this.requestor.total_cap;
  
          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }
  
  setRecipient(team_id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.assets_received = Array(6).fill(null);
      this.assets_received_types = Array(6).fill('');
  
      this.teamService.getRosterByTeam(this.league_id, team_id).subscribe(
        response => {
          this.recipient = response.team;

          this.recipient.roster_size = response.roster.length;
          this.recipient.total_cap = this.getTotalCap(response.roster) + this.recipient.salary_retained;
          this.recipient_retention_slots = this.countRetentionSlots(response.roster);

          this.recipient.roster = this.clearSalaryRetention(response.roster);
          this.recipient.draft_picks = response.draft_picks;
          this.recipient.fa_picks = response.fa_picks.filter(pick => pick.owned_by === this.recipient.team_id && !pick.player_taken);
  
          if (this.globalService.league) {
            this.recipient.cap_space = this.globalService.league.salary_cap - this.recipient.total_cap;
          }
  
          this.recipient_rookies = this.countRookies(this.recipient.roster);
          this.recipient_contracts = this.recipient.roster_size - this.recipient_rookies;
          this.recipient_salary = this.recipient.total_cap;
  
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
    if (team === 'requestor') {
      this.assets_given = Array(6).fill(null);
      this.assets_given_types = Array(6).fill('');
    }
    if (team === 'recipient') {
      this.assets_received = Array(6).fill(null);
      this.assets_received_types = Array(6).fill('');
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
    for (let asset of this.assets_given) {
      if (asset?.player_id === player.player_id) {
        asset.retention_perc = player.retention_perc;
        return;
      }
    }
    for (let asset of this.assets_received) {
      if (asset?.player_id === player.player_id) {
        asset.retention_perc = player.retention_perc;
        return;
      }
    }
  }

  removeRetention(player_id: string): void {
    if (this.requestor.player_retained === player_id) {
      this.requestor.player_retained = null;
      this.requestor.salary_retained = 0;
    }
    if (this.recipient.player_retained === player_id) {
      this.recipient.player_retained = null;
      this.recipient.salary_retained = 0;
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
    this.requestor_rookies = this.countRookies(this.requestor.roster);
    this.requestor_contracts = this.requestor.roster_size - this.requestor_rookies;
    this.requestor_salary = this.requestor.total_cap;

    this.recipient_rookies = this.countRookies(this.recipient.roster);
    this.recipient_contracts = this.recipient.roster_size - this.recipient_rookies;
    this.recipient_salary = this.recipient.total_cap;
  }

  adjustSalaries(): void {
    this.resetAdjustments();

    for (let asset of this.assets_given) {
      if (asset && this.getAssetType(asset) === 'player') {
        if (asset.isRookie) {
          this.recipient_rookies++;
          this.requestor_rookies--;
        }
        else {
          this.recipient_contracts++;
          this.recipient_salary += asset.aav_current - (asset.aav_current * (asset.retention_perc / 100));
          this.requestor_contracts--;
          this.requestor_salary -= asset.aav_current - (asset.aav_current * (asset.retention_perc / 100));
        }
      }
    }

    for (let asset of this.assets_received) {
      if (asset && this.getAssetType(asset) === 'player') {
        if (asset.isRookie) {
          this.requestor_rookies++;
          this.recipient_rookies--;
        }
        else {
          this.requestor_contracts++;
          this.requestor_salary += asset.aav_current - (asset.aav_current * (asset.retention_perc / 100));
          this.recipient_contracts--;
          this.recipient_salary -= asset.aav_current - (asset.aav_current * (asset.retention_perc / 100));
        }
      }
    }
  }

  addCondition(): void {
    if (this.trade_conditions.length < 6) {
      this.trade_conditions.push("");
    }
  }

  removeCondition(index: number): void {
    this.trade_conditions.splice(index, 1);
  }

  trackIndex(index: number, obj: any): any {
    return index;
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
    return (this.rosterIsValid(this.requestor_contracts) && this.rookieIsValid(this.requestor_rookies) && this.salaryIsValid(this.requestor_salary)
            && this.rosterIsValid(this.recipient_contracts) && this.rookieIsValid(this.recipient_rookies) && this.salaryIsValid(this.recipient_salary)
          )
  }

  sendTrade(): void {
    const payload = {
      league_id: this.league_id,
      requested_by: this.requestor.team_id,
      sent_to: this.recipient.team_id,
      assets: [
          {
            player_id: '',
            draft_pick_id: '',
            fa_id: '',
            traded_to: '',
            traded_from: '',
            retention_perc: '',
            asset_type: ''
          }
      ],
      conditions: this.trade_conditions
    };
  
    for (let asset of this.assets_given) {
      const formattedAsset = {
          player_id: this.getAssetType(asset) === 'player' ? asset?.player_id : null,
          draft_pick_id: this.getAssetType(asset) === 'draft_pick' ? asset?.asset_id : null,
          fa_id: this.getAssetType(asset) === 'fa' ? asset?.asset_id : null,
          traded_to: this.recipient.team_id,
          traded_from: this.requestor.team_id,
          retention_perc: asset?.retention_perc > 0 ? asset?.retention_perc : null,         
          asset_type: this.getAssetType(asset)
      };
      payload.assets.push(formattedAsset);
    }

    for (let asset of this.assets_received) {
      const formattedAsset = {
          player_id: this.getAssetType(asset) === 'player' ? asset?.player_id : null,
          draft_pick_id: this.getAssetType(asset) === 'draft_pick' ? asset?.asset_id : null,
          fa_id: this.getAssetType(asset) === 'fa' ? asset?.asset_id : null,
          traded_to: this.requestor.team_id,
          traded_from: this.recipient.team_id,
          retention_perc: asset?.retention_perc > 0 ? asset?.retention_perc : null,      
          asset_type: this.getAssetType(asset)
      };
      payload.assets.push(formattedAsset);
    }

    payload.assets = payload.assets.filter(asset => asset.asset_type !== '');
    payload.conditions = payload.conditions.filter(condition => condition !== '');

    console.log('Payload', payload);
    
    this.http.post('api/send-trade', payload)
    .subscribe({
      next: (response) => {

        this.router.navigate(['/' + this.league_id + '/team/' + this.globalService.loggedInTeam?.team_id]);
          this.toastService.showToast('Your trade request has been sent!.', true)
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });
  }

  openModal(template: TemplateRef<any>, asset?: Asset, team?: Team): void {
    if (asset && asset.player_id) {
      const player = asset as Player;
      this.selected_player = player;
    }
    if (team) {
      this.selected_team = team;
    }
    this.modalRef = this.modalService.show(template);
  }

  closeModal() {
    this.modalRef.hide();
  }

}
