import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { HomeComponent } from './components/home/home.component';
import { AppComponent } from './app.component';

const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    
    // Core league routes
    { path: ':league_id', component: AppComponent, pathMatch: 'full' },
    { path: ':league_id/home', component: HomeComponent },
    
    // Feature module routes with prefixes
    {
        path: ':league_id/team',
        loadChildren: () => import('./modules/team/team.module').then(m => m.TeamModule)
    },
    {
        path: ':league_id/league',
        loadChildren: () => import('./modules/league/league.module').then(m => m.LeagueModule)
    },
    {
        path: ':league_id/admin',
        loadChildren: () => import('./modules/admin/admin.module').then(m => m.AdminModule)
    },
    {
        path: ':league_id/trade',
        loadChildren: () => import('./modules/trade/trade.module').then(m => m.TradeModule)
    },
    {
        path: ':league_id/draft',
        loadChildren: () => import('./modules/draft/draft.module').then(m => m.DraftModule)
    },

    { path: '**', redirectTo: 'login' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }