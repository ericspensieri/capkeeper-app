import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Player, Draft_Pick, Log, Draft } from '../types';

@Injectable({
  providedIn: 'root'
})
export class PlayerService {

  constructor(
    private http: HttpClient
  ) { }

  generateID(first_name: string, last_name: string): string {
    const processedFirstName = first_name
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, '');
  
    const processedLastName = last_name
      .toLowerCase()
      .replace(/'/g, '-')
      .replace(/\./g, '')
      .replace(/\s+/g, '-');
    const id = processedFirstName + '-' + processedLastName;
    return id;
  }

  getAllPlayers(league_id: string): Observable<{ players: Player[] }> {
    const url = `api/${league_id}/players`;
    return this.http.get<{ players: Player[] }>(url);
  }

  getPlayerByID(player_id: string): Observable<{ player: Player }> {
    const url = `api/get-player`;
    const params = new HttpParams().set('id', player_id);
    return this.http.get<{ player: Player }>(url, { params });
  }
  
  getDraftByYear(league_id: string, year: number): Observable<{ draftPicks: Draft_Pick[] }> {
    const url = `api/${league_id}/draft`;
    const params = new HttpParams().set('year', year);
    return this.http.get<{ draftPicks: Draft_Pick[] }>(url, { params });
  }

  getDrafts(league_id: string, year: number): Observable<{ drafts: Draft[], draftPicks: Draft_Pick[] }> {
    const url = `api/${league_id}/draft`;
    const params = new HttpParams().set('year', year);
    return this.http.get<{ drafts: Draft[], draftPicks: Draft_Pick[] }>(url, { params });
  }

  getDraftById(league_id: string, draft_id: string): Observable<{ draft: Draft, draftPicks: Draft_Pick[] }> {
    const url = `api/${league_id}/draft`;
    const params = new HttpParams().set('draft_id', draft_id);
    return this.http.get<{ draft: Draft, draftPicks: Draft_Pick[] }>(url, { params });
  }

  getProtectionSheet(league_id: string, team_id: string): Observable<{ players: Player[] }> {
    const url = `api/${league_id}/${team_id}/protection-sheet`;
    return this.http.get<{ players: Player[] }>(url);
  }

  scrapeContracts(date: string, forceAll: boolean, inOffseason: boolean): Observable<Log> {
    const url = `api/scrape-contracts`;
    const params = new HttpParams()
      .set('date', date)
      .set('forceAll', forceAll.toString())
      .set('inOffseason', inOffseason.toString());
    return this.http.get<Log>(url, { params });
  }

  scrapeTrades(date: string, forceAll: boolean, year: number): Observable<Log> {
    const season = `${year}-${(year + 1).toString().slice(-2)}`;
    const url = `api/scrape-trades`;
    const params = new HttpParams()
      .set('date', date)
      .set('year', season)
      .set('forceAll', forceAll.toString());
    return this.http.get<Log>(url, { params });
  }
  
}
