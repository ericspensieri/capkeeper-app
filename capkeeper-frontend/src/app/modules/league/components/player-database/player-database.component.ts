import { Component, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GlobalService } from '@app/services/global.service';
import { PlayerService } from '@app/services/player.service';
import { SortingService } from '@app/services/sorting.service';
import { PaginationService } from '@app/services/pagination.service';
import { TeamService } from '@app/services/team.service';
import { ToastService } from '@app/services/toast-service.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Team, Player, FA_Pick, Log, Log_Row } from '@app/types';

interface Warning {
  header: string,
  message: string,
  isRed: boolean
}

@Component({
  selector: 'app-player-database',
  templateUrl: './player-database.component.html',
  styleUrl: './player-database.component.css',
  standalone: false
})

export class PlayerDatabaseComponent {
  modalRef!: BsModalRef;
  isLoading = false;
  displaying: 'contracts' | 'trades' = 'contracts';
  league_id!: string;
  allPlayers!: Player[];
  filteredPlayers: Player[] = [];
  selected!: Player;
  teams: Team[] = [];
  fa_picks: FA_Pick[] = [];
  fa_to_use!: string;
  searchKey: string = '';
  statusFilter = 'all';
  positionFilter = 'all';
  teamFilter = 'all';
  maxSalary: number = 15000000;
  warnings: Warning[] = [];
  scrapeLogs!: Log;
  formSubmitted: boolean = false;
  addNextContract: boolean = false;
  toastMessage: string = '';
  formData = {
    first_name: '',
    last_name: '',
    short_code: '',
    position: '',
    years_left_current: null as number | null,
    aav_current: null as number | null,
    years_left_next: null as number | null,
    aav_next: null as number | null,
    expiry_status: '',
};

  constructor(
    private playerService: PlayerService,
    private teamService: TeamService,
    public globalService: GlobalService,
    public sortingService: SortingService,
    private modalService: BsModalService,
    private toastService: ToastService,
    public paginationService: PaginationService,
    private route: ActivatedRoute,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.sortingService.sortColumn = 'last_name';
      this.sortingService.sortDirection = 'asc';
      this.league_id = params.get('league_id')!;

      this.playerService.getAllPlayers(this.league_id)
        .subscribe(response => {
          this.allPlayers = response.players;
          this.filterPlayers();
      });

      if (this.globalService.loggedInTeam) {
        this.fetchFAs(this.globalService.loggedInTeam);
      }

    });
  }

  searchPlayers(): void {
    if (this.searchKey === '') { this.resetSearch(); return; }
    this.filterPlayers();
  }

  async fetchFAs(team: Team): Promise<void> {
    this.teamService.getFAsByTeam(this.league_id, team.team_id)
      .subscribe(response => {
        this.fa_picks = response.fa_picks.filter(pick => pick.owned_by === this.globalService.loggedInTeam?.team_id && !pick.player_taken && this.faInRange(pick));
        if (this.fa_picks.length > 0) {
          this.fa_to_use = this.fa_picks[0].asset_id.toString();
        }
      });
  }

  faInRange(fa: FA_Pick): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    const twoDaysBefore = new Date(today);
    twoDaysBefore.setDate(today.getDate() - 2);
  
    const eightDaysAfter = new Date(today);
    eightDaysAfter.setDate(today.getDate() + 8);
  
    let expiryDate = new Date(fa.expiry_date);
    const targetDate = new Date(2025, 2, 2); // March 2, 2025

    // helper method for four nations faceoff long week 
    const isSameDay = expiryDate.getFullYear() === targetDate.getFullYear() &&
                     expiryDate.getMonth() === targetDate.getMonth() &&
                     expiryDate.getDate() === targetDate.getDate();
  
    return (expiryDate >= twoDaysBefore && expiryDate <= eightDaysAfter) || 
           (!this.globalService.faIsExpired(fa) && isSameDay);
}

  filterPlayers(): void {
    this.filteredPlayers = this.allPlayers
      .filter(player => 
              this.inPosFilter(player) 
              && this.inStatusFilter(player) 
              && this.inTeamFilter(player) 
              && this.inSalaryFilter(player) 
              && (player.first_name.toLowerCase().includes(this.searchKey.toLowerCase()) || player.last_name.toLowerCase().includes(this.searchKey.toLowerCase()))
            );
    this.sortingService.sort(this.filteredPlayers, this.sortingService.sortColumn, this.sortingService.sortDirection);
    this.paginationService.calculateTotalPages(this.filteredPlayers);
    this.paginationService.setPage(1);
  }

  clearFilter(): void {
    this.searchKey = '';
    this.statusFilter = 'all';
    this.positionFilter = 'all';
    this.teamFilter = 'all';
    this.maxSalary = 15000000;
    this.filterPlayers();
  }

  isSkater(player: Player): boolean {
    return player.position === 'F' || player.position === 'D';
  }

  inPosFilter(player: Player): boolean {
    if (this.positionFilter === 'all') { return true; }
    if (this.positionFilter === 'skater' && this.isSkater(player)) { return true; }
    return player.position === this.positionFilter;
  }

  inStatusFilter(player: Player): boolean {
    if (this.statusFilter === 'all') { return true; }
    if (this.statusFilter === 'available' && player.owned_by === null) { return true; }
    if (this.statusFilter === 'unsigned' && player.contract_status === 'Unsigned') { return true; }
    if (this.statusFilter === 'active' && player.contract_status === 'Active') { return true; }
    if (this.statusFilter === 'owned' && player.owned_by !== null) { return true; }
    if (this.globalService.loggedInTeam && player.owned_by === null && this.statusFilter === 'affordable' && player.aav_current <= this.globalService.loggedInTeam?.cap_space) { return true; }
    return false;
  }

  inTeamFilter(player: Player): boolean {
    return player.owned_by === this.teamFilter || this.teamFilter === 'all';
  }

  inSalaryFilter(player: Player): boolean {
    return player.aav_current < this.maxSalary || player.contract_status === 'Unsigned';
  }

  resetSearch(): void {
    this.searchKey = '';
    this.filterPlayers();
  }

  generateID(first_name: string, last_name: string): string {
    const id = first_name.toLowerCase().replace(/\s+/g, '') + '-' + last_name.toLowerCase().replace(/\s+/g, '');
    console.log(id)
    return id;
  }

  validatePickup(player: Player): boolean {
    return this.capIsValid(player) && this.contractIsValid();
  }

  capIsValid(player: Player): boolean {
    if (this.globalService.loggedInTeam?.cap_space && player.aav_current > this.globalService.loggedInTeam?.cap_space) {
      return false;
    }
    return true;
  }

  faIsValid(): boolean {
    if (this.fa_to_use) {
      return true;
    }
    return false;
  }

  contractIsValid(): boolean {
    if (this.globalService.loggedInTeam?.roster_size && this.globalService.league?.max_roster_size) {
      if (this.globalService.league?.max_roster_size <= this.globalService.loggedInTeam?.roster_size ) {
        return false;
      }
    }
    return true;
  }

  addPlayer(player: Player, rookie: boolean): void {
    const payload = {
      player_id: player.player_id,
      league_id: this.league_id,
      team_id: this.globalService.loggedInTeam?.team_id,
      isRookie: rookie,
      fa_used: this.fa_to_use,
      action: 'add',
      last_updated: this.globalService.getToday(),
      updated_by: this.globalService.loggedInUser?.first_name + ' ' + this.globalService.loggedInUser?.last_name
    }

    this.http.post('api/players/add-drop', payload)
    .subscribe({
      next: (response) => {
        console.log('Action recorded successfully:', response);
        if (this.globalService.loggedInTeam && this.globalService.loggedInUser) {
          this.globalService.updateTeamCap(this.globalService.loggedInTeam);

          let message = player.first_name + ' ' + player.last_name + ' added from free agency by ' + this.globalService.loggedInTeam.team_name;
          let action = 'add-player';
          this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, action, message);

          //this.fetchFAs(this.globalService.loggedInTeam);
          this.ngOnInit;
          this.toastService.showToast(message, true);
        }
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });

  }

  playerFormSubmit(event: Event) {
    const formElement = event.target as HTMLFormElement;
    const action = formElement.getAttribute('data-action');

    const submissionData = {
      action: action,
      player_id: action === 'edit' ? this.selected.player_id : this.generateID(this.formData.first_name, this.formData.last_name),
      first_name: this.formData.first_name,
      last_name: this.formData.last_name,
      position: this.formData.position,
      short_code: this.formData.short_code,
      last_updated: this.globalService.getToday(),
      updated_by: this.globalService.loggedInUser?.first_name + ' ' + this.globalService.loggedInUser?.last_name,
    };

    let message;
    let action_type;
    if (submissionData.action === 'add') {
      message = submissionData.first_name + ' ' + submissionData.last_name + ' added to the player database.';
      action_type = 'create-player';
    }
    else {
      message = 'Saved changes to player profile for ' + submissionData.first_name + ' ' + submissionData.last_name + '.';
      action_type = 'edit-player';
    }
    
    this.http.post('/api/players/create-player', submissionData)
      .subscribe({
        next: (response) => {
          
          this.toastService.showToast(message, true);
          console.log('Changes saved.', response);

          this.formSubmitted = true;
          setTimeout(() => {
            this.formSubmitted = false;
          }, 3000);
          this.resetForm();
        },
        error: (error) => {
          console.error('Error submitting form', error, submissionData);
        }
      });

      if (this.globalService.loggedInUser) {
        this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, action_type, message);
      }
      
      this.closeModal();
      this.ngOnInit();
  }

  contractFormSubmit(event: Event) {
    const submissionData = {
      player_id: this.selected.player_id,
      aav_current: this.formData.aav_current,
      years_left_current: this.formData.years_left_current,
      aav_next: this.formData.aav_next,
      years_left_next: this.formData.years_left_next,
      expiry_status: this.formData.expiry_status,
      last_updated: this.globalService.getToday(),
      updated_by: this.globalService.loggedInUser?.first_name + ' ' + this.globalService.loggedInUser?.last_name,
    };

    let message = '';
    if (this.selected) {
      message = 'Player contract information updated for ' + this.selected.first_name + ' ' + this.selected.last_name + '.';
    }
    
    let action_type = 'edit-contract';
    this.http.post('/api/players/edit-contract', submissionData)
      .subscribe({
        next: (response) => {
          
          this.toastService.showToast(message, true);

          this.formSubmitted = true;
          setTimeout(() => {
            this.formSubmitted = false;
          }, 3000);
          this.resetForm();
        },
        error: (error) => {
          console.error('Error submitting form', error, submissionData);
        }
      });

      if (this.globalService.loggedInUser) {
        this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, action_type, message);
      }
      
     this.closeModal();
     this.ngOnInit();
  }

  addContract(): void {
    this.addNextContract = !this.addNextContract;
  }

  selectPlayer(player: Player) {
    this.selected = player;
    this.formData.first_name = this.selected.first_name;
    this.formData.last_name = this.selected.last_name;
    this.formData.short_code = this.selected.short_code;
    this.formData.position = this.selected.position;
    this.formData.years_left_current = this.selected.years_left_current;
    this.formData.aav_current = this.selected.aav_current;
    this.formData.years_left_next = this.selected.years_left_next;
    this.formData.aav_next = this.selected.aav_next;
    this.formData.expiry_status = this.selected.expiry_status;
  }

  resetForm() {
    this.formData.first_name = '';
    this.formData.last_name = '';
    this.formData.short_code = '';
    this.formData.position = '';
    this.formData.years_left_current = null;
    this.formData.aav_current = null;
    this.formData.years_left_next = null;
    this.formData.aav_next = null;
    this.formData.expiry_status = '';
  }

  isButtonDisabled(): boolean {
    return this.formData.first_name === '' || this.formData.last_name === '' || this.formData.position === '' || this.formData.short_code === '';
  }

  syncPlayers(forceAll: boolean): void {
    this.displaying === 'contracts';
    const today = this.globalService.getToday();
    this.isLoading = true;
    
    this.playerService.scrapeContracts(today, forceAll)
      .subscribe(response => {
        this.scrapeLogs = response;
        this.isLoading = false;
  
        if (this.globalService.loggedInUser && this.scrapeLogs.rows.length > 0) {
          let message = 'Database Sync Completed: ' + this.scrapeLogs.rows.length + ' contracts updated.';
          this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, 'sync', message);
        }
      });
  }
  
  setDisplay(display: 'contracts' | 'trades'): void {
    this.displaying = display;
  }

  openModal(template: TemplateRef<any>, player?: Player): void {
    if (player) {
      this.selectPlayer(player);
    }
    this.modalRef = this.modalService.show(template);
  }

  closeModal() {
    this.modalRef.hide();
    this.resetForm();
    this.resetSearch();
    this.addNextContract = false;
  }

}
