import { Component } from '@angular/core';
import { TradeProposalComponent } from '../../../trade/components/trade-proposal/trade-proposal.component';
import { TeamService } from '@app/services/team.service';
import { GlobalService } from '@app/services/global.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ToastService } from '@app/services/toast-service.service';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Trade } from '@app/types';

@Component({
  selector: 'app-trade-review',
  templateUrl: './trade-review.component.html',
  styleUrls: ['./trade-review.component.css'],
  standalone: false
})
export class TradeReviewComponent extends TradeProposalComponent {
  trade!: Trade;

  constructor(
    teamService: TeamService,
    globalService: GlobalService,
    modalService: BsModalService,
    toastService: ToastService,
    route: ActivatedRoute,
    http: HttpClient,
    router: Router,
  ) {
    super(teamService, globalService, modalService, toastService, route, http, router);
  }

  override async ngOnInit(): Promise<void> {
    const params = await firstValueFrom(this.route.paramMap);
    this.league_id = params.get('league_id')!;
    let trade_id = params.get('trade_id')!;
  
    const response = await firstValueFrom(this.teamService.getTradeByID(this.league_id, trade_id));
    this.trade = response.trade;
    for (let condition of response.tradeConditions) {
      this.trade_conditions.push(condition.description);
    }
  
    await this.setRequestor(this.trade.requested_by);
    await this.setRecipient(this.trade.sent_to);
  
    this.assets_given = response.tradeItems.filter(asset => asset?.traded_to === this.recipient.team_id);
    this.assets_received = response.tradeItems.filter(asset => asset?.traded_to === this.requestor.team_id);
    console.log(this.assets_given)
    this.adjustSalaries();
  }
  
  acceptTrade(): void {
    const payload = {
      league_id: this.league_id,
      trade_id: this.trade.trade_id,
      action: 'accept'
    };

    console.log(payload);

    this.http.post('api/confirm-trade', payload)
      .subscribe({
        next: (response) => {
          let message = 'A trade has been accepted by ' + this.globalService.loggedInTeam?.team_name;

          if (this.globalService.loggedInUser) {
            this.globalService.recordAction(this.league_id, this.globalService.loggedInUser?.user_name, 'trade', message, this.trade.trade_id);
          }

          this.router.navigate(['/' + this.league_id + '/team/' + this.globalService.loggedInTeam?.team_id]).then(() => {
            if (this.globalService.loggedInTeam) {
              this.globalService.updateTeamCap(this.globalService.loggedInTeam);
            }
            this.toastService.showToast('Trade confirmed!', true);
          });
        },
        error: (error) => {
          console.error('Error recording action:', error);
        }
      });
}

  rejectTrade(): void {
    const payload = {
      league_id: this.league_id,
      trade_id: this.trade.trade_id,
      action: 'reject'
    };

    this.http.post('api/confirm-trade', payload)
    .subscribe({
      next: (response) => {
        this.router.navigate(['/' + this.league_id + '/team/' + this.globalService.loggedInTeam?.team_id]);
        if (this.globalService.loggedInTeam) {
          this.globalService.updateTeamCap(this.globalService.loggedInTeam);
        }
        this.toastService.showToast('Trade rejected.', false);
      },
      error: (error) => {
        console.error('Error recording action:', error);
      }
    });
  }
}
