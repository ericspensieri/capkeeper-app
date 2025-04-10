import { Component } from '@angular/core';
import { GlobalService } from '@app/services/global.service';
import { PlayerService } from '@app/services/player.service';
import { Team, Player, Draft_Pick, Draft } from '@app/types';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-draft',
  templateUrl: './draft.component.html',
  styleUrl: './draft.component.css',
  standalone: false
})

export class DraftComponent {
  league_id!: string;
  year: number = 2024;
  teams!: Team[];
  drafts!: Draft[];
  rookie_draft!: Draft;
  rookie_order: Team[] = [];
  rookie_picks!: Draft_Pick[];
  general_draft!: Draft;
  general_order: Team[] = [];
  general_picks!: Draft_Pick[];
  genOrderSet = false;
  rookieOrderSet = false;

  constructor(
    private playerService: PlayerService,
    public globalService: GlobalService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) { }
  
  async ngOnInit(): Promise<void> {
    const params = await firstValueFrom(this.route.paramMap);
    this.league_id = params.get('league_id')!;

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

    this.fetchDrafts(this.league_id, this.year);

  }

  async fetchDrafts(league_id: string, year: number): Promise<void> {
    this.playerService.getDrafts(league_id, year)
      .subscribe((response) => {
      this.drafts = response.drafts;
      const generalDraft = response.drafts.find(draft => draft.type === 'general' && draft.year === year);
      const rookieDraft = response.drafts.find(draft => draft.type === 'rookie' && draft.year === year);
      
      if (generalDraft) {
        this.genOrderSet = true;
        this.general_draft = generalDraft;
        this.general_draft.draft_picks = response.draftPicks.filter((pick) => pick.type === 'general');
      } else {
        this.genOrderSet = false;
      }
      if (rookieDraft) {
        this.rookieOrderSet = true;
        this.rookie_draft = rookieDraft;
        this.rookie_draft.draft_picks = response.draftPicks.filter((pick) => pick.type === 'rookie');
      } else {
        this.rookieOrderSet = false;
      }

      this.setDraftOrders();
    });
  }

  setDraftOrders(): void {
    this.general_draft.draft_order = [];
    this.rookie_draft.draft_order = [];
    const rookie_first_round = this.rookie_draft.draft_picks.filter((pick) => pick.round === 1);
    for (let pick of rookie_first_round) {
      const team = this.matchTeamByID(pick.assigned_to);
      if (team) {
        this.rookie_draft.draft_order.push(team);
      }
    }

    const general_first_round = this.general_draft.draft_picks.filter((pick) => pick.round === 1);
    for (let pick of general_first_round) {
      const team = this.matchTeamByID(pick.assigned_to);
      if (team) {
        this.general_draft.draft_order.push(team);
      }
    }
  }
  
  getDraftYears(): number[] {
    const years: number[] = [];
    for (let draft of this.drafts) {
      if (!years.includes(draft.year)) {
        years.push(draft.year);
      }
    }
    return years.sort((a, b) => a - b);
  }

  matchTeamByID(team_id: string): Team | null {
    for (let team of this.teams) {
      if (team.team_id === team_id) {
        return team
      }
    }
    return null;
  }

  getPickInfo(team_id: string, round: number, draft: string): Draft_Pick | undefined {
    if (draft === 'rookie') {
      return this.rookie_draft.draft_picks.find(pick => pick.round === round && pick.assigned_to === team_id);
    }
    return this.general_draft.draft_picks.find(pick => pick.round === round && pick.assigned_to === team_id);
  }

  getTeamImage(pick: Draft_Pick): string {
      for (let team of this.teams) {
        if (team.team_id === pick.owned_by) {
          return team.picture
        }
      }
      return '';
  }

}
