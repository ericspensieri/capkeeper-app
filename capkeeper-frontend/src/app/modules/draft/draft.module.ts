import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { ModalModule } from 'ngx-bootstrap/modal';

import { DraftComponent } from './components/draft/draft.component';
import { DraftRoomComponent } from './components/draft-room/draft-room.component';
import { TradeModule } from '../trade/trade.module';

const routes: Routes = [
  { path: 'history', component: DraftComponent },
  { path: 'live/:draft_id', component: DraftRoomComponent },
];

@NgModule({
  declarations: [
    DraftComponent,
    DraftRoomComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    TradeModule,
    HttpClientModule,
    ModalModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    DraftComponent,
    DraftRoomComponent
  ]
})
export class DraftModule { }