import { Component, TemplateRef } from '@angular/core';
import { GlobalService } from '@app/services/global.service';
import { TeamService } from '@app/services/team.service';
import { PlayerService } from '@app/services/player.service';
import { ToastService } from '@app/services/toast-service.service';
import { SortingService } from '@app/services/sorting.service';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BsModalRef, BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { Team, Player, Protection_Sheet } from '@app/types';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-protection-sheet',
  templateUrl: './protection-sheet.component.html',
  styleUrl: './protection-sheet.component.css',
  standalone: false
})
export class ProtectionSheetComponent {
  modalRef!: BsModalRef;
  editRights: boolean = false;
  league_id!: string;
  salary_cap: number = 0;
  year: number = 2024;
  sheet: Protection_Sheet = {} as Protection_Sheet;
  team!: Team;

  constructor(
    protected teamService: TeamService,
    protected playerService: PlayerService,
    public globalService: GlobalService,
    public sortingService: SortingService,
    protected modalService: BsModalService,
    protected toastService: ToastService,
    protected route: ActivatedRoute,
    private router: Router,
    protected http: HttpClient,
  ) { }

  async ngOnInit(): Promise<void> {
    const params = await firstValueFrom(this.route.paramMap);
    this.league_id = params.get('league_id')!;
  
    if (!this.globalService.loggedInTeam) {
      try {
        await this.globalService.initializeLeague(this.league_id, this.router.url);
      } catch (error) {
        console.error('Error during league initialization:', error);
      }
    }
  
    if (this.globalService.loggedInTeam) {
      this.initializeSheet();
      this.setTeam(this.globalService.loggedInTeam.team_id);
    }
  }

  sheetIsPending(): boolean {
    return this.sheet.status !== 'final' && this.sheet.status !== 'processed';
  }
  
  setTeam(team_id: string): Promise<void> {
    this.clearSheet();
    this.loadSheet(team_id, false);
    return new Promise((resolve, reject) => {
      this.teamService.getRosterByTeam(this.league_id, team_id).subscribe(
        response => {
          this.team = response.team;

          if (team_id === this.globalService.loggedInTeam?.team_id) {
            this.editRights = true;
          } else {
            this.editRights = false;
          }

          this.team.roster = response.roster.filter(player => !player.isRookie);
          this.sortingService.sort(this.team.roster, 'aav_current', 'desc');
          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  initializeSheet(): void {
    if (this.globalService.league) {
      this.sheet.sheet_cap = this.globalService.league.protection_sheet_limit;
      this.sheet.bench_cap = this.globalService.league.protection_sheet_bench + (this.sheet.sheet_cap/2);
      this.sheet.bench_base = this.globalService.league.protection_sheet_bench;
      this.sheet.year = this.globalService.league.current_season;
      this.sheet.sheet_total = 0;
      this.sheet.bench_total = 0;
      this.sheet.max_f = 5;
      this.sheet.max_d = 3;
      this.sheet.max_g = 1;
      this.sheet.max_bench = 6;
      this.sheet.protected_count = 0;
      this.sheet.franchise_player = null;
      this.sheet.protected_forwards = [];
      this.sheet.f_protected = 0;
      this.sheet.protected_defense = [];
      this.sheet.d_protected = 0;
      this.sheet.protected_goalies = [];
      this.sheet.g_protected = 0;
      this.sheet.bench = [];
    }
  }

  getForwards(): Player[] {
    return this.team.roster.filter(player => player.position === 'F');
  }

  getDefense(): Player[] {
    return this.team.roster.filter(player => player.position === 'D');
  }

  getGoalies(): Player[] {
    return this.team.roster.filter(player => player.position === 'G');
  }

  getBench(): Player[] {
    return this.sheet.bench;
  }

  getFranchise(): Player | null {
    return this.sheet.franchise_player;
  }

  toggleFranchise(player: Player): void {
    if (this.sheet.franchise_player && this.sheet.franchise_player === player) {
      this.decrementProtectionCount(player);
      this.sheet.franchise_player = null;
    }
    else {
      if (this.sheet.franchise_player) {
        this.decrementProtectionCount(this.sheet.franchise_player)
      }
      if (this.isProtected(player)) {
        this.removePlayer(player);
      }

      if (player.position === 'F' && this.sheet.protected_forwards.length >= this.sheet.max_f) {
          const removedForward = this.sheet.protected_forwards[this.sheet.max_f - 1];
          this.removePlayer(removedForward);
      }
      if (player.position === 'D' && this.sheet.protected_defense.length >= this.sheet.max_d) {
          const removedDefense = this.sheet.protected_defense[this.sheet.max_d - 1];
          this.removePlayer(removedDefense);
      }
      if (player.position === 'G' && this.sheet.protected_goalies.length >= this.sheet.max_g) {
          const removedGoalie = this.sheet.protected_goalies[this.sheet.max_g - 1];
          this.removePlayer(removedGoalie);
      }

      this.incrementProtectionCount(player);
      this.sheet.franchise_player = player;
    }
  }

  incrementProtectionCount(player: Player): void {
    this.sheet.protected_count++;
    if (player.position === 'F') { this.sheet.f_protected++; }
    if (player.position === 'D') { this.sheet.d_protected++; }
    if (player.position === 'G') { this.sheet.g_protected++; }  
  }

  decrementProtectionCount(player: Player): void {
    this.sheet.protected_count--;
    if (player.position === 'F') { this.sheet.f_protected--; }
    if (player.position === 'D') { this.sheet.d_protected--; }
    if (player.position === 'G') { this.sheet.g_protected--; }  
  }

  toggleProtection(player: Player): void {
    if (!this.isProtected(player)) {
      if (this.mainSheetIsValid(player)) {
        this.protectPlayer(player);
        return;
      }
      else if (this.benchIsValid(player)) {
        this.addToBench(player);
        return;
      } 
    }
    else {
      this.removePlayer(player);
    }
  }

  protectPlayer(player: Player): void {
    if (player.position === 'F') { this.sheet.protected_forwards.push(player); }
    if (player.position === 'D') { this.sheet.protected_defense.push(player); }
    if (player.position === 'G') { this.sheet.protected_goalies.push(player) }  
    this.incrementProtectionCount(player);
    this.sheet.sheet_total += player.aav_current;
    this.sheet.bench_cap = this.sheet.bench_base + (this.sheet.sheet_cap - this.sheet.sheet_total) / 2; 
  }

  addToBench(player: Player): void {
    this.sheet.bench.push(player);
    this.sheet.bench_total += player.aav_current;
    this.sheet.protected_count++;
  }

  removePlayer(player: Player): void {
    const removeFromArray = (arr: Player[]): boolean => {
        const index = arr.findIndex(p => p === player);
        if (index !== -1) {
            arr.splice(index, 1);
            return true;
        }
        return false;
    };

    if (player === this.sheet.franchise_player) {
      this.toggleFranchise(player);
      return;
    }

    let removed = false;
    if (player.position === 'F') {
        removed = removeFromArray(this.sheet.protected_forwards);
    } else if (player.position === 'D') {
        removed = removeFromArray(this.sheet.protected_defense);
    } else if (player.position === 'G') {
        removed = removeFromArray(this.sheet.protected_goalies);
    }

    if (!removed) {
        removeFromArray(this.sheet.bench);
        this.sheet.bench_total -= player.aav_current;
        this.sheet.protected_count--;
    }

    if (removed) {
        this.decrementProtectionCount(player);
        this.sheet.sheet_total -= player.aav_current;
        this.sheet.bench_cap = this.sheet.bench_base + (this.sheet.sheet_cap - this.sheet.sheet_total) / 2;
    }
  }

  mainSheetIsValid(player: Player): boolean {
    if (player.position === 'F') {
      if (this.sheet.f_protected < this.sheet.max_f && (this.sheet.sheet_total + player.aav_current) <= this.sheet.sheet_cap) {
        return true;
      }
    }
    if (player.position === 'D') {
      if (this.sheet.d_protected < this.sheet.max_d && (this.sheet.sheet_total + player.aav_current) <= this.sheet.sheet_cap) {
        return true;
      }
    }
    if (player.position === 'G') {
      if (this.sheet.g_protected < this.sheet.max_g && (this.sheet.sheet_total + player.aav_current) <= this.sheet.sheet_cap) {
        return true;
      }
    }
    return false;
  }

  benchIsValid(player: Player): boolean {
    if (this.sheet.bench.length < this.sheet.max_bench && (this.sheet.bench_total + player.aav_current <= this.sheet.bench_cap)) {
      return true;
    }
    return false;
  }

  isProtected(player: Player): boolean {
    if (player === this.getFranchise()) { return true; }
    if (player.position === 'F') {
      for (let forward of this.sheet.protected_forwards) {
        if (player === forward) { return true; }
      }
    }
    if (player.position === 'D') {
      for (let defensemen of this.sheet.protected_defense) {
        if (player === defensemen) { return true; }
      }
    }
    if (player.position === 'G') {
      for (let goalie of this.sheet.protected_goalies) {
        if (player === goalie) { return true; }
      }
    }

    for (let onBench of this.sheet.bench) {
      if (player === onBench) { return true; }
    }
    return false;
  }

  clearSheet(): void {
    this.sheet.protected_count = 0;
    this.sheet.franchise_player = null;
    this.sheet.protected_forwards = [];
    this.sheet.f_protected = 0;
    this.sheet.protected_defense = [];
    this.sheet.d_protected = 0;
    this.sheet.protected_goalies = [];
    this.sheet.g_protected = 0;
    this.sheet.bench = [];

    this.sheet.sheet_total = 0;
    this.sheet.bench_total = 0;
    this.sheet.bench_cap = this.sheet.bench_base + ((this.sheet.sheet_cap - this.sheet.sheet_total) / 2);
  }

  sheetIsValid(): boolean {
    if (this.sheet.franchise_player 
        && this.sheet.f_protected === this.sheet.max_f 
        && this.sheet.d_protected === this.sheet.max_d 
        && this.sheet.g_protected === this.sheet.max_g 
        && this.sheet.bench_total < this.sheet.bench_cap) {
      return true;
    }
    return false;
  }

  submitSheet(): void {
    const payload: { players: { player_id: string; onBench: boolean; isFranchise: boolean }[] } = {
      players: []
    };
  
    const addPlayers = (playersArray: any[], onBench: boolean, isFranchise: boolean) => {
      for (let player of playersArray) {
        if (player && player.player_id) { 
          payload.players.push({
            player_id: player.player_id,
            isFranchise,
            onBench
          });
        }
      }
    };
    
    payload.players.push({
      player_id: this.sheet.franchise_player ? this.sheet.franchise_player.player_id : '',
      isFranchise: true,
      onBench: false
    });
    addPlayers(this.sheet.protected_forwards, false, false);
    addPlayers(this.sheet.protected_defense, false, false);
    addPlayers(this.sheet.protected_goalies, false, false);
    addPlayers(this.sheet.bench, true, false);
  
    let year = this.globalService.league?.current_season;
    const url = `/api/${this.league_id}/${this.team?.team_id}/protection-sheet?year=${year}`;
    this.http.post(url, payload)
      .subscribe({
        next: () => {
          this.loadSheet(this.team.team_id, false);
          this.toastService.showToast('Protection Sheet Saved!', true);
        },
        error: (error) => {
          console.error('Error submitting protection sheet:', error);
        }
      });
  }

  async loadSheet(team_id: string, withPlayers: boolean): Promise<void> {
    this.clearSheet();

    return new Promise((resolve, reject) => {
      this.playerService.getProtectionSheet(this.league_id, team_id, this.year).subscribe(
        response => {
          
          console.log('Repsonse', response);
          if (response.sheet) {
            this.sheet.status = response.sheet.status;
            this.sheet.sheet_id = response.sheet.sheet_id;
          }
          
          if (withPlayers) {
            if (response.players.length > 0) {
            
              for (let player of response.players) {
                const rosterPlayer = this.team.roster.find(p => p.player_id === player.player_id);
                
                if (!rosterPlayer) {
                  console.warn(`Player with ID ${player.player_id} not found in the roster.`);
                  continue;
                }
            
                if (player.isFranchise) {
                  this.toggleFranchise(rosterPlayer);
                  continue;
                }
            
                if (player.onBench) {
                  this.addToBench(rosterPlayer);
                } else {
                  this.protectPlayer(rosterPlayer);
                }
              }
              this.toastService.showToast('Protection Sheet loaded successfully.', true);
  
            } else {
              this.toastService.showToast('No protection sheet found.', false);
            }
          }

          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  finalizeSheet(): void {
    if (this.sheet.sheet_id !== null) {
      const url = `/api/finalize-sheet/${this.sheet.sheet_id}?status=final`;
      this.http.post(url, {})
        .subscribe({
          next: () => {
            this.loadSheet(this.team.team_id, false);
            this.toastService.showToast('Protection Sheet Finalized!', true);
          },
          error: (error) => {
            console.error('Error submitting protection sheet:', error);
          }
      });
    }
  }

  rejectSheet(): void {
    if (this.sheet.sheet_id !== null) {
      const url = `/api/finalize-sheet/${this.sheet.sheet_id}?status=saved`;
      this.http.post(url, {})
        .subscribe({
          next: () => {
            this.loadSheet(this.team.team_id, false);
            this.toastService.showToast('Protection Sheet Rejected', false);
          },
          error: (error) => {
            console.error('Error submitting protection sheet:', error);
          }
      });
    }
  }

  processSheet(): void {
    const payload: { players: { player_id: string }[], last_updated: string, updated_by: string } = {
      players: [],
      last_updated: this.globalService.getToday(),
      updated_by: this.globalService.loggedInUser?.first_name + ' ' + this.globalService.loggedInUser?.last_name
    };
    
    for (let player of this.team.roster) {
      if (!this.isProtected(player)) {
        payload.players.push({
          player_id: player.player_id,
        });
        this.dropPlayerFromTeam(player);
      }
    }

    if (this.sheet.sheet_id !== null) {
      const url = `/api/finalize-sheet/${this.sheet.sheet_id}?status=processed`;
      this.http.post(url, payload)
        .subscribe({
          next: () => {
            if (this.globalService.loggedInUser && this.sheet.sheet_id) {
              let message = 'Protection Sheet processed for ' + this.team.team_name;
              let action = 'protection-sheet';
              this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, action, message, '', this.sheet.sheet_id);
            }         
            this.loadSheet(this.team.team_id, false);
            this.toastService.showToast('Protection Sheet Processed!', true);
          },
          error: (error) => {
            console.error('Error submitting protection sheet:', error);
          }
      });
    }
  }

  dropPlayerFromTeam(player: Player): void {
    const payload = {
      player_id: player.player_id,
      league_id: this.league_id,
      action: 'drop',
      last_updated: this.globalService.getToday(),
      updated_by: this.globalService.loggedInUser?.first_name + ' ' + this.globalService.loggedInUser?.last_name
    }

    this.http.post('api/players/add-drop', payload)
    .subscribe({
      next: (response) => {
        console.log('Player dropped successfully:', response);
        if (this.globalService.loggedInTeam && this.globalService.loggedInUser) {
          this.globalService.updateTeamCap(this.globalService.loggedInTeam);
        }
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });
  }

  openModal(template: TemplateRef<any>): void {
    this.modalRef = this.modalService.show(template);
  }

  closeModal() {
    this.modalRef.hide();
  }


}
