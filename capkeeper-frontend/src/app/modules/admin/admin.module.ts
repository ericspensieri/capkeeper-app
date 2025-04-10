import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { ModalModule } from 'ngx-bootstrap/modal';

import { CommissionerHubComponent } from './components/commissioner-hub/commissioner-hub.component';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { ProtectionSheetComponent } from './components/protection-sheet/protection-sheet.component';
import { DraftOrderPipe } from './pipes/draft-order-pipe';
import { RulesComponent } from './components/rules/rules.component';
import { DraftOrderComponent } from './components/draft-order/draft-order.component';

const routes: Routes = [
  { path: 'commissioner-hub', component: CommissionerHubComponent },
  { path: 'user/:user_name', component: UserProfileComponent },
  { path: 'protection-sheet', component: ProtectionSheetComponent },
  { path: 'rules', component: RulesComponent }
];

@NgModule({
  declarations: [
    CommissionerHubComponent,
    UserProfileComponent,
    ProtectionSheetComponent,
    DraftOrderPipe,
    RulesComponent,
    DraftOrderComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    ModalModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    CommissionerHubComponent,
    UserProfileComponent,
    ProtectionSheetComponent,
    DraftOrderPipe,
    RulesComponent,
    DraftOrderComponent
  ]
})
export class AdminModule { }