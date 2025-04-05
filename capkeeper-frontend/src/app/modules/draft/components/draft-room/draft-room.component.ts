import { Component, TemplateRef, ElementRef, ViewChild, HostListener } from '@angular/core';
import { GlobalService } from '@app/services/global.service';
import { PlayerService } from '@app/services/player.service';
import { Team, Player, Draft_Pick, Draft } from '@app/types';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TeamService } from '@app/services/team.service';
import { ToastService } from '@app/services/toast-service.service';
import { TradeService } from '@app/modules/trade/services/trade.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-draft',
  templateUrl: './draft-room.component.html',
  styleUrl: './draft-room.component.css',
  standalone: false
})

export class DraftRoomComponent {
  @ViewChild('settingsButton') settingsButton!: ElementRef;
  @ViewChild('settingsDropdown') settingsDropdown!: ElementRef;
  modalRef!: BsModalRef;
  tradePartner!: string;
  league_id!: string;
  draft_id!: string;
  showSettingsDropdown: boolean = false;
  year: number = 2024;
  teams!: Team[];
  draft!: Draft;
  status: 'ready' | 'in-progress' | 'paused' | 'complete' = 'ready';
  rounds: number = 0;
  pickClockDefault: number = 240;
  countdown: number = 240;
  pickClock: any = null;
  usePickClock: boolean = true;   
  currentRound = 1;
  pickOfRound = 1;
  nextPick = 1;
  onTheClock!: Team;
  allPlayers!: Player[];
  filteredPlayers: Player[] = [];
  takenPlayers: Player[] = [];
  positionFilter = 'all';
  searchKey: string = '';
  searchResults: Player[] = [];
  formData = {
    first_name: '',
    last_name: '',
    short_code: '',
    position: '',
    years_left_current: null as number | null,
    aav_current: null as number | null,
    expiry_status: '',
  };
  testMode: boolean = true;

  constructor(
    private playerService: PlayerService,
    private teamService: TeamService,
    public globalService: GlobalService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private modalService: BsModalService,
    private toastService: ToastService,
    public tradeService: TradeService,
  ) { }
  
  async ngOnInit(): Promise<void> {
    const params = await firstValueFrom(this.route.paramMap);
    this.league_id = params.get('league_id')!;
    this.draft_id = params.get('draft_id')!;
    this.tradeService.league_id = this.league_id;

    if (this.globalService.teams.length === 0) {
      try {
        await this.globalService.initializeLeague(this.league_id, this.router.url);
      } catch (error) {
        console.error('Error during league initialization:', error);
        return; 
      }
    }
  
    this.teams = this.globalService.teams;
    if (this.globalService.league) {
      this.year = this.globalService.league.current_season;
    }

    await this.fetchDraftById(this.league_id, this.draft_id);
    await this.initializeTeams();
    await this.fetchPlayers(false);

    this.onTheClock = this.draft.draft_order[0];
    let index = 0;
    console.log(this.draft.draft_picks)
    while (this.draft.draft_picks[index].player_taken !== null) {
      const player = this.allPlayers.find(player => player.player_id === this.draft.draft_picks[index].player_taken)
      if (player) {
        this.draftPlayer(player, false);
      } else if (this.draft.draft_picks[index].player_taken === 'none') {
        this.burnPick(false);
      }
      index++;
    }
    this.resetPickClock();
  }

  async fetchDraftById(league_id: string, draft_id: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.playerService.getDraftById(league_id, draft_id));
      const draft = response.draft;
      if (draft) {
        this.draft = draft;
        this.draft.draft_picks = response.draftPicks;
      }
      this.setDraftOrder();
      this.rounds = draft.draft_picks.length / draft.draft_order.length;
    } catch (error) {
      console.error('Failed to fetch draft data:', error);
    }
  }

  async fetchPlayers(showToast: boolean): Promise<void> {
    try {
        const response = await firstValueFrom(this.playerService.getAllPlayers(this.league_id));
        this.allPlayers = response.players;
        this.filteredPlayers = this.allPlayers;
        this.filterPlayers();
        if (showToast) {
          this.toastService.showToast("Draft Room has been Refreshed", true);
          this.showSettingsDropdown = false;
        }
    } catch (error) {
        console.error('Failed to fetch players:', error);
    }
  }

  async refreshDraftRoom(showToast: boolean): Promise<void> {
    await this.fetchDraftById(this.league_id, this.draft_id);
    await this.initializeTeams();
    await this.fetchPlayers(showToast);
    
    const draftingNow = this.draft.draft_order.find(team => team.team_id === this.pickBelongsTo(this.nextPick));
    if (draftingNow && draftingNow !== this.onTheClock) {
      this.onTheClock = draftingNow;
      this.resetPickClock();
      this.startPickClock();
    }
  }

  async initializeTeams(): Promise<void> {
    for (let i = 0; i < this.draft.draft_order.length; i++) {
      try {
        const teamId = this.draft.draft_order[i].team_id;
        
        const response = await firstValueFrom(this.teamService.getRosterByTeam(this.league_id, teamId));
        this.draft.draft_order[i] = response.team

        console.log('Response', response)
        
        this.draft.draft_order[i].roster = response.roster;
        this.draft.draft_order[i].num_forwards = response.roster.filter(player => player.position === 'F' && !player.isRookie && !player.onIR).length;
        this.draft.draft_order[i].num_defense = response.roster.filter(player => player.position === 'D' && !player.isRookie && !player.onIR).length;
        this.draft.draft_order[i].num_goalies = response.roster.filter(player => player.position === 'G' && !player.isRookie && !player.onIR).length;
        this.draft.draft_order[i].rookie_count = response.roster.filter(player => player.isRookie).length;
        
        this.draft.draft_order[i].roster_size = response.roster.length - this.draft.draft_order[i].rookie_count;
        this.draft.draft_order[i].total_cap = this.getTotalSalary(this.draft.draft_order[i].roster) + this.draft.draft_order[i].salary_retained;
        
        if (this.globalService.league?.salary_cap) {
          this.draft.draft_order[i].cap_space = this.globalService.league.salary_cap - this.draft.draft_order[i].total_cap;
        }
        
      } catch (error) {
        console.error(`Error fetching team ${this.draft.draft_order[i].team_id}:`, error);
      }
    }
  }

  isRookieDraft(): boolean {
    return this.draft.type === 'rookie';
  }

  toggleSettingsDropdown(): void {
    this.showSettingsDropdown = !this.showSettingsDropdown;
  }

  draftInProgress(): boolean {
    return this.status === 'in-progress';
  }

  draftComplete(): boolean {
    return this.status === 'complete'
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: any): void {
    if (this.showSettingsDropdown &&
        this.settingsButton &&
        this.settingsDropdown &&
        !this.settingsButton.nativeElement.contains(event.target) &&
        !this.settingsDropdown.nativeElement.contains(event.target)) {
      this.showSettingsDropdown = false;
    }
  }

  setDraftOrder(): void {
    this.draft.draft_order = [];
    const first_round = this.draft.draft_picks.filter((pick) => pick.round === 1);
    for (let pick of first_round) {
      const team = this.matchTeamByID(pick.assigned_to);
      if (team) {
        this.draft.draft_order.push(team);
      }
    }
  }

  getTotalSalary(array: Player[]): number {
    let sum = 0;
    for (let player of array) {
      if (player.retention_perc && player.retention_perc > 0) {
        sum += player.aav_current * (1 - (player.retention_perc / 100))
      }
      else if (!player.isRookie) {
        sum += player.aav_current;
      }
    }
    return sum;
  }

  matchTeamByID(team_id: string): Team | null {
    for (let team of this.teams) {
      if (team.team_id === team_id) {
        return team
      }
    }
    return null;
  }

  getPickInfo(team_id: string, round: number): Draft_Pick | undefined {
    return this.draft.draft_picks.find(pick => pick.round === round && pick.assigned_to === team_id);
  }

  getTeamImage(pick: Draft_Pick): string {
      for (let team of this.teams) {
        if (team.team_id === pick.owned_by) {
          return team.picture
        }
      }
      return '';
  }

  draftPlayer(selection: Player, persist: boolean) {
    this.setPickSelection(selection, this.onTheClock, persist);
    this.takenPlayers.push(selection);
    this.onTheClock.roster.push(selection);

    if (persist) {
      if (this.isRookieDraft()) {
        this.onTheClock.rookie_count++;
      } 
      else {
        this.onTheClock.total_cap += selection.aav_current;
        this.onTheClock.roster_size++;
        if (this.globalService.league?.salary_cap) {
          this.onTheClock.cap_space = this.globalService.league.salary_cap - this.onTheClock.total_cap;
        }
            
        switch (selection.position) {
          case 'F':
            this.onTheClock.num_forwards++;
            break;
          case 'D':
            this.onTheClock.num_defense++;
            break;
          case 'G':
            this.onTheClock.num_goalies++;
            break;
        }
      }
    
      const message = selection.first_name + ' ' + selection.last_name + ' selected by ' + this.onTheClock.team_name;
      this.toastService.showToast(message, true);

    }

    this.advancePick();
    this.filterPlayers();
  }

  setPickSelection(selection: Player, team: Team, persist: boolean): void {
    const pickIndex = this.draft.draft_picks.findIndex(pick => pick.pick_number === this.nextPick);
    if (pickIndex !== -1) {
      this.draft.draft_picks[pickIndex].player_taken = selection.player_id;
      this.draft.draft_picks[pickIndex].player_first_name = selection.first_name;
      this.draft.draft_picks[pickIndex].player_last_name = selection.last_name;
      this.draft.draft_picks[pickIndex].player_position = selection.position;
      this.draft.draft_picks[pickIndex].player_short_code = selection.short_code;
      if (!this.testMode && persist) {
        this.addPlayerToTeam(selection, team, this.isRookieDraft());
        this.persistPick(this.draft.draft_picks[pickIndex]);
      }
    }
  }

  burnPick(persist: boolean): void {
    const pickIndex = this.draft.draft_picks.findIndex(pick => pick.pick_number === this.nextPick);
    if (pickIndex !== -1) {
      this.draft.draft_picks[pickIndex].player_taken = 'none';
      if (!this.testMode && persist) {
        this.persistPick(this.draft.draft_picks[pickIndex]);
      }
    }
    if (persist) {
      const message = this.onTheClock.team_name + ' burn pick #' + this.nextPick;
      this.toastService.showToast(message, false);
    }
    this.advancePick();
  }

  advancePick(): void {
    if (this.nextPick < this.draft.draft_picks.length) {
      this.nextPick++;
      this.pickOfRound++;
      
      if (this.nextPick % this.draft.draft_order.length === 1) {
        this.pickOfRound = 1;
        this.currentRound++;
      }

      const nextTeam = this.draft.draft_order.find(team => team.team_id === this.pickBelongsTo(this.nextPick));
      if (nextTeam) {
        this.onTheClock = nextTeam;
      }
      this.resetPickClock();
      this.startPickClock();
    }
    else {
      this.status = 'complete';
      this.resetPickClock();
    }
  }

  undoPick(): void {
    if (this.nextPick > 1) {
      const prevPickNumber = this.nextPick - 1;
      const pickIndex = this.draft.draft_picks.findIndex(pick => pick.pick_number === prevPickNumber);
      
      if (pickIndex !== -1) {
        const pick = this.draft.draft_picks[pickIndex];
      
        if (pick.player_taken && pick.player_taken !== 'none') {
          const team = this.draft.draft_order.find(team => team.team_id === pick.owned_by);
          
          if (team) {
            const playerIndex = team.roster.findIndex(player => player.player_id === pick.player_taken);
            
            if (playerIndex !== -1) {
              const removedPlayer = team.roster[playerIndex];
              team.roster.splice(playerIndex, 1);
              team.roster_size--;
              
              team.total_cap -= removedPlayer.aav_current;
              if (this.globalService.league?.salary_cap) {
                team.cap_space = this.globalService.league.salary_cap - team.total_cap;
              }

              switch (removedPlayer.position) {
                case 'F':
                  team.num_forwards--;
                  break;
                case 'D':
                  team.num_defense--;
                  break;
                case 'G':
                  team.num_goalies--;
                  break;
              }

              if (!this.testMode) {
                this.dropPlayerFromTeam(removedPlayer);
              }
              
              const takenIndex = this.takenPlayers.findIndex(player => player.player_id === pick.player_taken);
              if (takenIndex !== -1) {
                this.takenPlayers.splice(takenIndex, 1);
              }
            }
          }
        }
        
        this.draft.draft_picks[pickIndex].player_taken = "";
        this.draft.draft_picks[pickIndex].player_first_name = "";
        this.draft.draft_picks[pickIndex].player_last_name = "";
        this.draft.draft_picks[pickIndex].player_position = "";
        this.draft.draft_picks[pickIndex].player_short_code = "";

        if (!this.testMode) {
          this.persistPick(this.draft.draft_picks[pickIndex]);
        }
      }
      
      this.nextPick--;
      this.pickOfRound--;
      
      if (this.pickOfRound === 0) {
        this.pickOfRound = this.draft.draft_order.length;
        this.currentRound--;
      }
      
      const prevTeam = this.draft.draft_order.find(team => team.team_id === this.pickBelongsTo(this.nextPick));
      if (prevTeam) {
        this.onTheClock = prevTeam;
      }
      
      this.resetPickClock();
      this.startPickClock();
      this.filterPlayers();
    }
  }

  persistPick(asset: Draft_Pick): void {
    const payload = {
      type: 'draft-pick',
      action: 'edit',
      asset_id: asset.asset_id,
      owned_by: asset.owned_by,
      player_taken: asset.player_taken === "" ? null : asset.player_taken,
    };
    
    this.http.post(`/api/edit-asset`, payload)
    .subscribe({
      next: (response) => {
        console.log(asset.player_taken + ' assigned to Asset #' + asset.asset_id);          
      },
      error: (error) => {
        console.error('Error submitting form', error, payload);
      }
    });
  }

  addPlayerToTeam(player: Player, team: Team, rookie: boolean): void {
    const payload = {
      player_id: player.player_id,
      league_id: this.league_id,
      team_id: team.team_id,
      isRookie: rookie,
      action: 'add',
      last_updated: this.globalService.getToday(),
      updated_by: this.globalService.loggedInUser?.first_name + ' ' + this.globalService.loggedInUser?.last_name
    }

    this.http.post('api/players/add-drop', payload)
    .subscribe({
      next: (response) => {
        console.log('Player added successfully:', response);
        if (this.globalService.loggedInTeam && this.globalService.loggedInUser) {
          this.globalService.updateTeamCap(this.globalService.loggedInTeam);
        }
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });
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

  searchPlayers(): void {
    if (this.searchKey === '') { this.resetSearch(); return; }
    this.filterPlayers();
  }

  resetSearch(): void {
    this.searchKey = '';
    this.filterPlayers();
  }

  isDraftable(player: Player, onTheClock: Team): boolean {
    if (this.status !== 'in-progress' || !onTheClock) {
      return false;
    } else {
      if (this.isRookieDraft()) {
        if (this.globalService.league) {
          return onTheClock.rookie_count < this.globalService.league.rookie_bank_size;
        } 
      }
      return player.aav_current < onTheClock.cap_space;
    }
  }
  
  filterPlayers(): void {
    this.filteredPlayers = this.allPlayers
      .filter(player => 
        this.inPosFilter(player)
        && this.isUnowned(player)
        && (this.isActive(player) || this.isRookieDraft())
        && (player.first_name.toLowerCase().includes(this.searchKey.toLowerCase()) 
            || player.last_name.toLowerCase().includes(this.searchKey.toLowerCase()))
        && !this.isPlayerTaken(player)); 
  }
  
  isPlayerTaken(player: Player): boolean {
    return this.takenPlayers.some(takenPlayer => takenPlayer.player_id === player.player_id);
  }

  inPosFilter(player: Player): boolean {
    if (this.positionFilter === 'all') { return true; }
    return player.position === this.positionFilter;
  }

  isUnowned(player: Player): boolean {
    return player.owned_by === null;
  }

  isActive(player: Player): boolean {
    return player.years_left_current > 0;
  }

  setPosFilter(filter: string): void {
    this.positionFilter = filter;
    this.filterPlayers();
  }

  startPickClock(): void {
    this.clearPickClock();
    
    if (this.usePickClock) {
      this.pickClock = setInterval(() => {
        this.countdown--;
        
        if (this.countdown <= 0) {
          this.clearPickClock();
        }
      }, 1000);
    }
  }
  
  clearPickClock(): void {
    if (this.pickClock) {
      clearInterval(this.pickClock);
      this.pickClock = null;
    }
  }
  
  pausePickClock(): void {
    this.clearPickClock();
  }
  
  resumePickClock(): void {
    if (!this.pickClock && this.countdown > 0 && this.usePickClock) {
      this.startPickClock();
    }
  }
  
  resetPickClock(seconds?: number): void {
    this.clearPickClock();
    this.countdown = seconds !== undefined ? seconds : this.pickClockDefault;
  }
  
  incrementPickClock(): void {
    if (this.pickClockDefault < 540) {
      this.pickClockDefault += 60;
    }
    this.resetPickClock();
  }
  
  decrementPickClock(): void {
    if (this.pickClockDefault > 60) {
      this.pickClockDefault -= 60;
    }
    this.resetPickClock();
  }
  
  formatPickClock(): string {
    const minutes = Math.floor(this.countdown / 60);
    const seconds = this.countdown % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  updatePickClockSettings(): void {
    if (!this.usePickClock) {
      this.pausePickClock();
    } else {
      this.resetPickClock();
      if (this.status === 'in-progress') {
        this.startPickClock();
      }
    }
  }

  getNextPicks(): number[] {
    const currentPick = this.nextPick;
    const totalPicks = this.draft.draft_order.length * this.rounds;
    
    const nextPicks: number[] = [];
    for (let i = 0; i < 4; i++) {
      const pick = currentPick + i;
      if (pick <= totalPicks) {
        nextPicks.push(pick);
      }
    }
    return nextPicks;
  }

  getRound(pick: number): number {
    const totalTeams = this.draft.draft_order.length;
    return Math.ceil(pick / totalTeams);
  }

  getPickOfRound(pick: number): number {
    const totalTeams = this.draft.draft_order.length;
    const remainder = pick % totalTeams;
    return remainder === 0 ? totalTeams : remainder;
  }

  pickBelongsTo(pick: number): string {
    const draftPick = this.draft.draft_picks.find(p => p.pick_number === pick);
    if (draftPick) {
      return draftPick.owned_by;
    }
    return "";
  }

  startDraft(): void {
    this.status = 'in-progress'
    this.startPickClock();
  }

  pauseDraft(): void {
    this.pausePickClock();
    this.status = 'paused';
  }

  resumeDraft(): void {
    this.resumePickClock();
    this.status = 'in-progress';
  }

  isButtonDisabled(): boolean {
    return this.formData.first_name === '' 
          || this.formData.last_name === '' 
          || this.formData.position === '' 
          || this.formData.short_code === '' 
          || this.formData.aav_current === null 
          || this.formData.years_left_current === null;
  }

  playerFormSubmit(event: Event) {
    const formElement = event.target as HTMLFormElement;
    const action = formElement.getAttribute('data-action');

    const submissionData = {
      action: action,
      player_id: this.playerService.generateID(this.formData.first_name, this.formData.last_name),
      first_name: this.formData.first_name,
      last_name: this.formData.last_name,
      position: this.formData.position,
      short_code: this.formData.short_code,
      aav_current: this.formData.aav_current,
      years_left_current: this.formData.years_left_current,
      last_updated: this.globalService.getToday(),
      updated_by: this.globalService.loggedInUser?.first_name + ' ' + this.globalService.loggedInUser?.last_name,
    };

    let message = submissionData.first_name + ' ' + submissionData.last_name + ' added to the player database.'
    let action_type = 'create-player';
    
    this.http.post('/api/players/create-player', submissionData)
      .subscribe({
        next: (response) => {
          
          this.toastService.showToast(message, true);
          this.fetchPlayers(false);
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
  }

  resetForm() {
    this.formData.first_name = '';
    this.formData.last_name = '';
    this.formData.short_code = '';
    this.formData.position = '';
    this.formData.years_left_current = null;
    this.formData.aav_current = null;
    this.formData.expiry_status = '';
  }

  submitTrade(): void {
    const payload = {
      league_id: this.league_id,
      requested_by: this.tradeService.team1.team_id,
      sent_to: this.tradeService.team2.team_id,
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
      conditions: this.tradeService.trade_conditions
    };
  
    for (let asset of this.tradeService.team1_assets) {
      const formattedAsset = {
          player_id: this.tradeService.getAssetType(asset) === 'player' ? asset?.player_id : null,
          draft_pick_id: this.tradeService.getAssetType(asset) === 'draft_pick' ? asset?.asset_id : null,
          fa_id: this.tradeService.getAssetType(asset) === 'fa' ? asset?.asset_id : null,
          traded_to: this.tradeService.team2.team_id,
          traded_from: this.tradeService.team1.team_id,
          retention_perc: asset?.retention_perc > 0 ? asset?.retention_perc : null,         
          asset_type: this.tradeService.getAssetType(asset)
      };
      payload.assets.push(formattedAsset);
    }

    for (let asset of this.tradeService.team2_assets) {
      const formattedAsset = {
          player_id: this.tradeService.getAssetType(asset) === 'player' ? asset?.player_id : null,
          draft_pick_id: this.tradeService.getAssetType(asset) === 'draft_pick' ? asset?.asset_id : null,
          fa_id: this.tradeService.getAssetType(asset) === 'fa' ? asset?.asset_id : null,
          traded_to: this.tradeService.team1.team_id,
          traded_from: this.tradeService.team2.team_id,
          retention_perc: asset?.retention_perc > 0 ? asset?.retention_perc : null,      
          asset_type: this.tradeService.getAssetType(asset)
      };
      payload.assets.push(formattedAsset);
    }

    payload.assets = payload.assets.filter(asset => asset.asset_type !== '');
    payload.conditions = payload.conditions.filter(condition => condition !== '');

    console.log('Payload', payload);
    
    this.http.post('api/send-trade', payload)
    .subscribe({
      next: (response) => {
        console.log(response);
        const trade_id = response.toString();
        if (trade_id) {
          this.persistTrade(trade_id);
        }
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    }); 
  }

  persistTrade(trade_id: string): void {
    const payload = {
      league_id: this.league_id,
      trade_id: trade_id,
      action: 'accept'
    };

    this.http.post('api/confirm-trade', payload)
      .subscribe({
        next: (response) => {
          let message = 'A trade has been accepted by ' + this.globalService.loggedInTeam?.team_name;

          if (this.globalService.loggedInUser) {
            this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, 'trade', message, trade_id);
          }

          this.refreshDraftRoom(false);
          this.toastService.showToast('Trade completed!', true);
        },
        error: (error) => {
          console.error('Error recording action:', error);
        }
      });
  }

  tradePartnerPipe(index: number): any[] {
    if (!this.draft?.draft_order) {
      return [];
    }
    
    const teamToExclude = index === 0 ? this.tradeService.team2?.team_id : this.tradeService.team1?.team_id;
    if (teamToExclude) {
      return this.draft.draft_order.filter(team => 
        team.team_id !== teamToExclude
      );
    }
    
    return this.draft.draft_order;
  }

  openModal(template: TemplateRef<any>, modalType?: string): void {
    if (modalType === 'trade') {
      this.tradeService.setteam1(this.onTheClock.team_id);
      let index = 0;
      if (this.onTheClock === this.draft.draft_order[0]) {
        index = 1;
      }
      this.tradeService.setteam2(this.draft.draft_order[index].team_id);
    }
    this.modalRef = this.modalService.show(template);
  }

  closeModal() {
    this.modalRef.hide();
  }

}
