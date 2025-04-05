import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { ModalModule } from 'ngx-bootstrap/modal';

import { TradeProposalComponent } from './components/trade-proposal/trade-proposal.component';
import { TradeReviewComponent } from './components/trade-review/trade-review.component';
import { TradeAssetPipe } from './pipes/trade-assets.pipe';
import { TradeService } from './services/trade.service';

const routes: Routes = [
  { path: 'propose', component: TradeProposalComponent },
  { path: 'review/:trade_id', component: TradeReviewComponent },
];

@NgModule({
  declarations: [
    TradeProposalComponent,
    TradeReviewComponent,
    TradeAssetPipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    ModalModule,
    RouterModule.forChild(routes)
  ],
  providers: [ 
    TradeService
  ],
  exports: [
    TradeProposalComponent,
    TradeReviewComponent,
    TradeAssetPipe,
  ]
})
export class TradeModule { }