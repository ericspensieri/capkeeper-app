import Boom from '@hapi/boom';
import { db } from '../database.js';
import * as cheerio from 'cheerio';
import axios from 'axios';

export const scrapeTradesRoute = {
    method: 'GET',
    path: '/api/scrape-trades',
    handler: async (req, h) => {
        const last_updated = req.query.date;
        const year = req.query.year;
        const yearPrefix = year.split('-');
        const currentYearPrefix = yearPrefix[0];
        const nextYearPrefix = `20${yearPrefix[1]}`;
        const forceAll = req.query.forceAll === 'true';
        const targetUrl = `https://capwages.com/trades/${year}`;
        const testMode = false;

        try {
            console.log(`Scraping trades from ${targetUrl}`);
            const response = await axios.get(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            const trades = [];
            let breakLoop = false;
            let processedTrades = 0;

            $(`div[id^="${currentYearPrefix}-"], div[id^="${nextYearPrefix}-"]`).each((i, tradeCard) => {
                try {
                    if (testMode && processedTrades >= 10) {
                        return false;
                    }
                    
                    if (breakLoop && !forceAll) {
                        console.log(`Skipping remaining trades - already processed the latest trades`);
                        return false;
                    }
                    
                    const tradeId = $(tradeCard).attr('id');
                    if (!tradeId) {
                        return;
                    }
                    
                    const tradeDate = tradeId.substring(0, 10); // Extract date from ID
                    
                    // Trade ID format = 2025-03-07-NJD-PIT
                    const tradeIdParts = tradeId.split('-');
                    if (tradeIdParts.length < 5) {
                        console.log(`Trade ID format unexpected: ${tradeId}`);
                        return;
                    }
                    
                    const team1Code = normalizeTeamCode(tradeIdParts[3]);
                    const team2Code = normalizeTeamCode(tradeIdParts[4]);
                    
                    const teamLists = $(tradeCard).find('ul.list-none');
                    
                    if (teamLists.length !== 2) {
                        console.log(`Unexpected number of team lists: ${teamLists.length}`);
                        return;
                    }
                    
                    const tradePlayers = [];
                    
                    $(teamLists[0]).find('a[href^="/players/"]').each((j, playerLink) => {
                        const playerUrl = $(playerLink).attr('href');
                        if (!playerUrl) return;
                        
                        const playerSlug = playerUrl.split('/').pop();
                        const nameParts = playerSlug.split('-');
                        if (nameParts.length < 2) return;
                        
                        const firstName = capitalizeFirst(nameParts[0]);
                        const lastName = capitalizeFirst(nameParts[1]);
                        
                        tradePlayers.push({
                            player_id: playerSlug,
                            firstName,
                            lastName,
                            newTeam: team1Code,
                            oldTeam: team2Code,
                        });
                    });
                    
                    $(teamLists[1]).find('a[href^="/players/"]').each((j, playerLink) => {
                        const playerUrl = $(playerLink).attr('href');
                        if (!playerUrl) return;
                        
                        const playerSlug = playerUrl.split('/').pop();
                        const nameParts = playerSlug.split('-');
                        if (nameParts.length < 2) return;
                        
                        const firstName = capitalizeFirst(nameParts[0]);
                        const lastName = capitalizeFirst(nameParts[1]);
                        
                        tradePlayers.push({
                            player_id: playerSlug,
                            firstName,
                            lastName,
                            newTeam: team2Code,
                            oldTeam: team1Code,
                        });
                    });
                    
                    if (tradePlayers.length > 0) {
                        trades.push({
                            tradeId,
                            team1: team1Code,
                            team2: team2Code,
                            players: tradePlayers,

                        });
                        processedTrades++;
                    }
                } catch (err) {
                    console.error(`Error processing trade card: ${err.message}`);
                }
            });
            
            const logs = [];
            const reversedTrades = [...trades].reverse();

            for (const trade of reversedTrades) {
                for (const player of trade.players) {
                    try {
                        const { results: [existingPlayer] } = await db.query(
                            'SELECT * FROM players WHERE player_id = ?',
                            [player.player_id]
                        );
                        
                        if (existingPlayer) {
                            await db.query(
                                `UPDATE players 
                                SET short_code = ?,
                                    last_updated = ?,
                                    updated_by = 'Capkeeper Bot'
                                WHERE player_id = ?`,
                                [
                                    player.newTeam,
                                    last_updated,
                                    player.player_id
                                ]
                            );
                            
                            logs.unshift({
                                status: 'updated',
                                player: `${player.firstName} ${player.lastName}`,
                                oldTeam: player.oldTeam,
                                newTeam: player.newTeam,
                                date: trade.tradeDate,
                            });
                        
                        } else {
                            logs.unshift({
                                status: 'skipped',
                                player: `${player.firstName} ${player.lastName}`,
                                oldTeam: player.oldTeam,
                                newTeam: player.newTeam,
                                date: trade.tradeDate,
                            });
                        }
                    } catch (err) {
                        console.error(`Error processing player ${player.firstName} ${player.lastName}:`, err);
                        logs.unshift({
                            status: 'error',
                            player: `${player.firstName} ${player.lastName}`,
                            error: err.message
                        });
                    }
                }
            }

            return {
                success: true,
                rows: logs,
                totalProcessed: logs.length,
                updates: logs.filter(r => r.status === 'updated').length,
                skipped: logs.filter(r => r.status === 'skipped').length,
                errors: logs.filter(r => r.status === 'error').length,
            };

        } catch (err) {
            console.error('Trade scraping error:', err);
            throw Boom.internal('Failed to scrape trades data', err);
        }
    }
};

const normalizeTeamCode = (teamCode) => {
    const codeMap = {
        'TBL': 'TB',
        'NJD': 'NJ',
        'LAK': 'LA',
        'SJS': 'SJ'
    };
    
    return codeMap[teamCode] || teamCode;
};

function extractTeamCode(html) {
    const teamMatches = html.match(/\b(ANA|ARI|BOS|BUF|CGY|CAR|CHI|COL|CBJ|DAL|DET|EDM|FLA|LAK|LA|MIN|MTL|NSH|NJD|NJ|NYI|NYR|OTT|PHI|PIT|SJS|SJ|SEA|STL|TBL|TB|TOR|VAN|VGK|WSH|WPG)\b/i);
    
    if (teamMatches && teamMatches[0]) {
        return teamMatches[0].toUpperCase();
    }
    
    return null;
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}