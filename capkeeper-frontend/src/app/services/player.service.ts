import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Player, Draft_Pick, Log, Log_Row } from '../types';

@Injectable({
  providedIn: 'root'
})
export class PlayerService {

  constructor(
    private http: HttpClient
  ) { }

  getAllPlayers(league_id: string): Observable<{ players: Player[] }> {
    const url = `api/${league_id}/players`;
    return this.http.get<{ players: Player[] }>(url);
  }

  getPlayerByID(player_id: string): Observable<{ player: Player }> {
    const url = `api/get-player`;
    const params = new HttpParams().set('id', player_id);
    return this.http.get<{ player: Player }>(url, { params });
  }
  
  getDraftByYear(league_id: string, year: number): Observable<{ draft: Draft_Pick[] }> {
    const url = `api/${league_id}/draft`;
    const params = new HttpParams().set('year', year);
    return this.http.get<{ draft: Draft_Pick[] }>(url, { params });
  }

  getProtectionSheet(league_id: string, team_id: string): Observable<{ players: Player[] }> {
    const url = `api/${league_id}/${team_id}/protection-sheet`;
    return this.http.get<{ players: Player[] }>(url);
  }

  scrapeContracts(date: string, forceAll: boolean): Observable<Log> {
    const url = `api/scrape-contracts`;
    const params = new HttpParams()
      .set('date', date)
      .set('forceAll', forceAll.toString());
    return this.http.get<Log>(url, { params });
  }
  
}
