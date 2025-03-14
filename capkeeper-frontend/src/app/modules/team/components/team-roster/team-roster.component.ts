import { Component, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GlobalService } from '../../../../services/global.service';
import { TeamService } from '../../../../services/team.service';
import { PlayerService } from '../../../../services/player.service';
import { ToastService } from '../../../../services/toast-service.service';
import { SortingService } from '../../../../services/sorting.service';
import { HttpClient } from '@angular/common/http';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Team, Player, FA_Pick, Draft_Pick } from '../../../../types';
import { Router } from '@angular/router';

@Component({
  selector: 'app-team-roster',
  templateUrl: './team-roster.component.html',
  styleUrl: './team-roster.component.css',
  standalone: false
})

export class TeamRosterComponent {
  editRights: boolean = false;
  inboxIsOpen: boolean = false;
  actionSuccessful: boolean = true;
  modalRef!: BsModalRef;
  league_id!: string;
  team_id!: string;
  team!: Team;
  selected!: Player;
  toSwap: Player | null = null;
  currentSeason!: string; 
  sortColumn: string | null = 'points';
  sortDirection: 'asc' | 'desc' = 'desc';
  displaying: 'general' | 'rookie' | 'fa' = 'general';
  toastMessage: string = '';
  formData = {
    old_team_id: null as string | null,
    league_id: null as string | null,
    team_id: null as string | null,
    team_name: null as string | null,
    picture: null as string | null,
  };

  constructor(
    private router: Router,
    private teamService: TeamService,
    public playerService: PlayerService,
    public globalService: GlobalService,
    private modalService: BsModalService,
    public sortingService: SortingService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(async (params) => {
      this.league_id = params.get('league_id')!;
      this.team_id = params.get('team_id')!;
  
      if (!this.globalService.loggedInTeam) {
        try {
          await this.globalService.initializeLeague(this.league_id, this.router.url);
        } catch (error) {
          console.error("Error during league initialization:", error);
          return;
        }
      }
  
      this.editRights = (this.team_id === this.globalService.loggedInTeam?.team_id);
      if (this.globalService.league) {
        this.currentSeason = this.formatSeasonYear(this.globalService.league.current_season);
      }
      this.initializeTeam(this.league_id, this.team_id);
    });
  }
  
  private initializeTeam(leagueId: string, teamId: string): void {
    this.teamService.getRosterByTeam(leagueId, teamId).subscribe((response) => {
      this.team = response.team;
  
      this.team.roster = response.roster.filter((player) => !player.isRookie && !player.onIR);
      this.team.rookie_bank = response.roster.filter((player) => player.isRookie);
      this.team.forwards = response.roster.filter((player) => player.position === 'F' && !player.isRookie && !player.onIR);
      this.team.defense = response.roster.filter((player) => player.position === 'D' && !player.isRookie && !player.onIR);
      this.team.goalies = response.roster.filter((player) => player.position === 'G' && !player.isRookie && !player.onIR);
      this.team.trade_block = response.roster.filter((player) => player.onTradeBlock);
      this.team.injured_reserve = response.roster.filter((player) => player.onIR);
  
      this.team.draft_picks = response.draft_picks;
      this.team.fa_picks = response.fa_picks;
      this.team.inbox = response.trades;
  
      this.team.roster_size = this.team.forwards.length + this.team.defense.length + this.team.goalies.length;
  
      this.team.forward_salary = this.getTotalSalary(this.team.forwards);
      this.team.defense_salary = this.getTotalSalary(this.team.defense);
      this.team.goalie_salary = this.getTotalSalary(this.team.goalies);
      this.team.ir_salary = this.getTotalSalary(this.team.injured_reserve);
      this.team.total_cap = this.team.forward_salary + this.team.defense_salary + this.team.goalie_salary + this.team.salary_retained;
  
      if (this.globalService.league?.salary_cap) {
        this.team.cap_space = this.globalService.league.salary_cap - this.team.total_cap;
      }
  
      this.sortingService.sort(this.team.forwards, 'aav_current', 'desc');
      this.sortingService.sort(this.team.defense, 'aav_current', 'desc');
      this.sortingService.sort(this.team.goalies, 'aav_current', 'desc');
      this.sortingService.sort(this.team.injured_reserve, 'aav_current', 'desc');
    });
  }
  

  setDisplay(display: 'general' | 'rookie' | 'fa'): void {
    this.displaying = display;
  }

  toggleInbox(): void {
    this.inboxIsOpen = ! this.inboxIsOpen;
  }

  formatSeasonYear(year: number): string {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }

  getMaxContractLength(array: Player[]): number {
    let max = 0;
    for (let player of array) {
      let sum  = player.years_left_current + player.years_left_next;
      if (sum > max) { max = sum }; 
    }
    return Math.max(max, 6);
  }

  getContractSeasons(array: Player[]): string[] {
    const maxContractLength = this.getMaxContractLength(array) + 1;
    let seasons: string[] = [];
    let next = this.currentSeason;
  
    for (let i = 0; i < maxContractLength; i++) {
      seasons.push(next);
      next = this.incrementSeason(next);
    }
    return seasons;
  }

  incrementSeason(season: string): string {
      const [startYear, endYear] = season.split('-').map(year => parseInt(year));
      const nextStartYear = startYear + 1;
      const nextEndYear = endYear + 1;
      const nextEndYearFormatted = nextEndYear.toString().slice(-2);
      return `${nextStartYear}-${nextEndYearFormatted}`; 
  }

  generateRange(count: number): number[] {
    return Array(count).fill(0).map((_, index) => index + 1);
  }

  getTotalSalary(array: Player[]): number {
    let sum = 0;
    for (let player of array) {
      if (player.retention_perc && player.retention_perc > 0) {
        sum += player.aav_current * (1 - (player.retention_perc / 100))
      }
      else {
        sum += player.aav_current;
      }
    }
    return sum;
  }

  getDraftYears(): number[] {
    const uniqueYears = new Set<number>();

    this.team.draft_picks.forEach(pick => {
        if (pick.year) {
            uniqueYears.add(pick.year);
        }
    });

    return Array.from(uniqueYears).sort((a, b) => a - b);
  }

  getPicksByRound(year: number, round: number, draft: string): number {
    let sum = 0;
    for (let pick of this.team.draft_picks) {
      if (pick.year === year && pick.round === round && pick.type === draft) {
        ++sum;
      }
    }
    return sum;
  }

  displayPicksByRound(year: number, round: number, draft: string): Draft_Pick[] {
    let array = [];
    for (let pick of this.team.draft_picks) {
      if (pick.year === year && pick.round === round && pick.type === draft) {
        array.push(pick);
      }
    }
    return array;
  } 

  getTotalPicksByYear(year: number, draft: string): number {
    let sum = 0;
    for (let pick of this.team.draft_picks) {
      if (pick.year === year && pick.type === draft) {
        ++sum;
      }
    }
    return sum;
  }

  getFAMonths(): string[] {
    const monthAbrv = ['OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR'];
    return monthAbrv;
  }

  getMonthIndex(abrv: string): number {
    const monthAbrv = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const index = monthAbrv.indexOf(abrv.toUpperCase());
    
    return index;
  }
  
  getFAPicksByMonth(index: number): FA_Pick[] {
    const picksInMonth: FA_Pick[] = [];
  
    this.team.fa_picks.forEach(pick => {
      if (pick.expiry_date) {
        const expiryDate = new Date(pick.expiry_date);
  
        if (expiryDate.getMonth() === index) {
          picksInMonth.push(pick);
        }
      }
    });
    return picksInMonth;
  }

  editTeamFormSubmit(event: Event): void {
    let new_id;
    if (this.formData.team_name) {
      new_id = this.formData.team_name.toLowerCase().replace(/\s+/g, '')
    } else {
      new_id = this.team_id
    }

    const submissionData = {
      old_team_id: this.team_id,
      league_id: this.team.league_id,
      team_id: new_id,
      team_name: this.formData.team_name ? this.formData.team_name : this.team.team_name,
      picture: this.formData.picture ? this.formData.picture : this.team.picture,
    };

    this.http.post('api/teams/edit-team-info', submissionData)
    .subscribe({
      next: (response) => {
        console.log('Team Info Updated Successfully:', response);
          this.router.navigate(['/' + this.team.league_id + '/teams/' + new_id]);
          this.closeModal();
          this.toastService.showToast('Team Information Updated Successfully!', true)
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });
    
  }
  
  dropPlayer(player: Player): void {
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
        console.log('Action recorded successfully:', response);
        if (this.globalService.loggedInTeam && this.globalService.loggedInUser) {
          this.globalService.updateTeamCap(this.globalService.loggedInTeam); 

          let message = player.first_name + ' ' + player.last_name + ' dropped to waivers by ' + this.team.team_name;
          let action = 'drop-player';
          this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, action, message);

          this.initializeTeam(this.league_id, this.team_id);
          this.toastService.showToast(player.first_name + ' ' + player.last_name + ' dropped to waivers.', true)
        }
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });

  }

  rosterMove(player: Player, event?: Event | string, template?: TemplateRef<any>): void {
    let action: string | undefined;

    if (typeof event === 'string') {
      action = event;
    } else if (event) {
      action = (event.target as HTMLSelectElement).value;
    }

    switch (action) {
      case 'ir':
        if (player.onIR) {
          if (template) {
            this.openModal(template, player);
          }
        }
        else {
          this.toggleIR(player);
        }
        break;
      case 'trade-block':
        this.toggleTradeBlock(player);
        break;
      case 'callup':
        if (template) {
          this.openModal(template, player);
        }
        break;
      default:
        console.log('No action selected');
    }
  }

  toggleIR(player: Player): boolean {
    let message = '';
  
    if (player.onIR) {
      message = player.first_name + ' ' + player.last_name + ' activated from IR by ' + this.team.team_name;   
      if (!this.toSwap) {
        this.toastService.showToast(player.first_name + ' ' + player.last_name + ' activated from IR.', true); 
      }
    }
  
    if (!player.onIR) {
      if (this.team.injured_reserve.length >= 3) {
        this.initializeTeam(this.league_id, this.team_id);
        this.toastService.showToast('Action could not be completed. Your IR slots are full.', false);
        return false;
      }
      message = player.first_name + ' ' + player.last_name + ' placed on IR by ' + this.team.team_name;
      this.toastService.showToast(player.first_name + ' ' + player.last_name + ' moved to IR.', true); 
    }
  
    const payload = {
      player_id: player.player_id,
      league_id: this.league_id,
      action: 'ir',
    };
  
    this.http.post('api/players/roster-move', payload)
    .subscribe({
      next: (response) => {
        if (this.globalService.loggedInTeam && this.globalService.loggedInUser) {
          this.globalService.updateTeamCap(this.globalService.loggedInTeam);
  
          let action = 'ir';
          this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, action, message);
  
          this.initializeTeam(this.league_id, this.team_id);
  
          if (this.toSwap) {
            const temp = this.toSwap
            this.toSwap = null;
            this.toggleIR(temp);
          }
        }
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });
  
    return true;
  }
  
  toggleTradeBlock(player: Player): void {
    const payload = {
      player_id: player.player_id,
      league_id: this.league_id,
      action: 'trade-block',
    }

    this.http.post('api/players/roster-move', payload)
    .subscribe({
      next: (response) => {
        if (this.globalService.loggedInTeam && this.globalService.loggedInUser) {

          if (!player.onTradeBlock) {
            let message = player.first_name + ' ' + player.last_name + ' added to the trade block by ' + this.team.team_name;
            let action = 'trade-block';
            this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, action, message);
            this.toastService.showToast(player.first_name + ' ' + player.last_name + ' added to the trade block.', true)
          }
          this.initializeTeam(this.league_id, this.team_id);
        }
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });
  }

  validateCallup(player: Player): boolean {
    return (this.capIsValid(player) || (this.toSwap ? this.swapIsValid(player, this.toSwap) : false)) && this.contractIsValid() && this.hasContract(player);
  }
  
  swapIsValid(player: Player, swap: Player): boolean {
    let diff = (swap.aav_current - (swap.aav_current * swap.retention_perc / 100)) - (player.aav_current - (player.aav_current * player.retention_perc / 100));
    if (this.team.cap_space && this.team.cap_space + diff >= 0) {
      return true;
    }
    return false;
  }

  capIsValid(player: Player): boolean {
    if (this.team.cap_space && (player.aav_current - (player.aav_current * player.retention_perc / 100)) > this.team.cap_space) {
      return false;
    }
    return true;
  }

  contractIsValid(): boolean {
    if (this.team.roster_size && this.globalService.league?.max_roster_size) {
      if (this.globalService.league?.max_roster_size <= this.team.roster_size) {
        return false;
      }
    }
    return true;
  }

  hasContract(player: Player): boolean {
    return player.aav_current > 0;
  }

  callupPlayer(player: Player): void {
    const payload = {
      player_id: player.player_id,
      league_id: this.league_id,
      action: 'callup',
    }

    this.http.post('api/players/roster-move', payload)
    .subscribe({
      next: (response) => {
        if (this.globalService.loggedInTeam && this.globalService.loggedInUser) {

          let message = player.first_name + ' ' + player.last_name + ' called up from the rookie bank by ' + this.team.team_name;
          let action = 'callup';
          this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, action, message);

          this.initializeTeam(this.league_id, this.team_id);
          this.toastService.showToast(player.first_name + ' ' + player.last_name + ' activated to main roster.', true)
        }
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });
  }

  uploadFile(event: any): boolean {
    const file: File = event.target.files[0];
  
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
  
      this.http.post('/api/upload', formData).subscribe({
        next: (response: any) => {
          console.log('File uploaded successfully:', response.fileUrl);
          this.formData.picture = response.fileUrl;
          return true;
        },
        error: (error) => {
          console.error('File upload failed:', error);
          return false;
        },
        complete: () => {
          console.log('File upload process completed.');
        }
      });
    }
    return false;
  } 

  openModal(template: TemplateRef<any>, player?: Player): void {
    if (player) {
      this.selected = player;
    }
    this.modalRef = this.modalService.show(template);
  }

  closeModal() {
    this.modalRef.hide();
    this.initializeTeam(this.league_id, this.team_id);
  }


}
