import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { ModalModule } from 'ngx-bootstrap/modal';

import { LeagueActivityComponent } from './components/league-activity/league-activity.component';
import { PlayerDatabaseComponent } from './components/player-database/player-database.component';

const routes: Routes = [
  { path: 'activity-log', component: LeagueActivityComponent },
  { path: 'players', component: PlayerDatabaseComponent },
];

@NgModule({
  declarations: [
    LeagueActivityComponent,
    PlayerDatabaseComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    ModalModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    LeagueActivityComponent,
    PlayerDatabaseComponent,
  ]
})
export class LeagueModule { }