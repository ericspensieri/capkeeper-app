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
            
            const tradesToProcess = [];
            let processedTrades = 0;
            let consecutiveMatchingTrades = 0;
            
            const tradeCards = [];
            $(`div[id^="${currentYearPrefix}-"], div[id^="${nextYearPrefix}-"]`).each(function(i) {
                const id = $(this).attr('id');
                tradeCards.push(this);
            });
            
            for (let i = 0; i < tradeCards.length; i++) {
                try {

                    if (testMode && processedTrades >= 3) {
                        break;
                    }
                    if (consecutiveMatchingTrades >= 3 && !forceAll) {
                        break;
                    }

                    const tradeCard = tradeCards[i];
                    const tradeId = $(tradeCard).attr('id');
                    const teamLists = $(tradeCard).find('ul.list-none');
                    let tradePlayers = [];
                    let team1Code, team2Code;
                    let tradeDate;

                    if (teamLists.length === 2) {
                       // Expected Trade ID format 2025-03-07-NJD-BOS
                        tradeDate = tradeId.substring(0, 10);
                        const tradeIdParts = tradeId.split('-');
                        team1Code = normalizeTeamCode(tradeIdParts[3]);
                        team2Code = normalizeTeamCode(tradeIdParts[4]);
                        
                        const teamLists = $(tradeCard).find('ul.list-none');
                        
                        $(teamLists[0]).find('a[href^="/players/"]').each((j, playerLink) => {
                            const playerUrl = $(playerLink).attr('href');
                            if (!playerUrl) return;
                            
                            const playerSlug = playerUrl.split('/').pop();
                            const specialCase = correctPlayerName(playerSlug);
                            let firstName, lastName;
                            
                            if (specialCase) {
                                firstName = specialCase.firstName;
                                lastName = specialCase.lastName;
                            } else {
                                const nameParts = playerSlug.split('-');
                                if (nameParts.length < 2) return;
                                
                                firstName = capitalizeFirst(nameParts[0]);
                                lastName = capitalizeFirst(nameParts[1]);
                            }
                            
                            tradePlayers.push({
                                player_id: playerSlug,
                                firstName,
                                lastName,
                                newTeam: team1Code,
                                oldTeam: team2Code,
                                date: tradeDate
                            });
                        });
                        
                        $(teamLists[1]).find('a[href^="/players/"]').each((j, playerLink) => {
                            const playerUrl = $(playerLink).attr('href');
                            if (!playerUrl) return;
                            
                            const playerSlug = playerUrl.split('/').pop();
                            const specialCase = correctPlayerName(playerSlug);
                            let firstName, lastName;
                            
                            if (specialCase) {
                                firstName = specialCase.firstName;
                                lastName = specialCase.lastName;
                            } else {
                                const nameParts = playerSlug.split('-');
                                if (nameParts.length < 2) return;
                                
                                firstName = capitalizeFirst(nameParts[0]);
                                lastName = capitalizeFirst(nameParts[1]);
                            }
                            
                            tradePlayers.push({
                                player_id: playerSlug,
                                firstName,
                                lastName,
                                newTeam: team2Code,
                                oldTeam: team1Code,
                                date: tradeDate
                            });
                        });

                    } else if (teamLists.length > 2) {
                        tradePlayers = await processMultiTeamTrade($, tradeCard, tradeId, db);
                    }
                    
                    if (tradePlayers.length === 0) {
                        continue;
                    }

                    let tradeNeedsProcessing = false;
                    const playersToUpdate = [];
                    
                    for (const player of tradePlayers) {
                        const normalizedFirstName = player.firstName.replace(/[.'"-]/g, '').toLowerCase();
                        const normalizedLastName = player.lastName.replace(/[.'"-]/g, '').toLowerCase();

                        const { results: matches } = await db.query(
                            `SELECT player_id, years_left_current, years_left_next, aav_current, aav_next, short_code, position 
                            FROM players 
                            WHERE player_id = ? 
                            OR (
                                (REPLACE(first_name, '.', '')) = ? 
                                AND (REPLACE(last_name, '.', '')) = ?
                            )`,
                            [player.player_id, normalizedFirstName, normalizedLastName]
                        );

                        const existingPlayer = matches[0];
                        
                        if (existingPlayer) {
                            if (existingPlayer.short_code !== player.newTeam || forceAll) {
                                tradeNeedsProcessing = true;
                                playersToUpdate.push({
                                    ...player,
                                    exists: true
                                });
                            } 
                        } else {
                            playersToUpdate.push({
                                ...player,
                                exists: false
                            });
                        }
                    }
                    
                    if (!tradeNeedsProcessing && !forceAll) {
                        consecutiveMatchingTrades++;
                        continue;
                    } else {
                        consecutiveMatchingTrades = 0;
                        tradesToProcess.push({
                            tradeId,
                            team1: team1Code,
                            team2: team2Code,
                            players: playersToUpdate,
                            date: tradeDate
                        });
                        
                        processedTrades++;
                    }
                    
                } catch (err) {
                    console.error(`Error processing trade card: ${err.message}`);
                }
            }

            const logs = [];
            const reversedTrades = [...tradesToProcess].reverse();
            
            for (const trade of reversedTrades) {
                for (const player of trade.players) {
                    try {
                        if (player.exists) {
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
                                date: player.date,
                            });
                        } else if (!player.exists) {
                            logs.unshift({
                                status: 'skipped',
                                player: `${player.firstName} ${player.lastName}`,
                                oldTeam: player.oldTeam,
                                newTeam: player.newTeam,
                                date: player.date,
                                reason: 'Player not found in database'
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
                tradesProcessed: processedTrades
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

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function processMultiTeamTrade($, tradeCard, tradeId, db) {
    const tradeDate = tradeId.substring(0, 10);
    const tradePlayers = [];
    const teamLists = $(tradeCard).find('ul.list-none');
    
    const playerQueries = [];
    
    for (let teamIndex = 0; teamIndex < teamLists.length; teamIndex++) {
        const teamList = teamLists[teamIndex];   
        const teamSection = $(teamList).closest('div[style*="background-image"]');
        const teamLogoImg = teamSection.find('img').first();
        
        let teamCode;
        if (teamLogoImg.length && teamLogoImg.attr('alt')) {
            teamCode = teamLogoImg.attr('alt');
        }
        
        teamCode = normalizeTeamCode(teamCode);
        $(teamList).find('a[href^="/players/"]').each((j, playerLink) => {
            if ($(playerLink).closest('button').length > 0) {
                return; // player flipped for salary retention
            }
            
            const playerSlug = $(playerLink).attr('href');
            if (!playerSlug) return;
            
            const specialCase = correctPlayerName(playerSlug);
            let firstName, lastName;
            
            if (specialCase) {
                firstName = specialCase.firstName;
                lastName = specialCase.lastName;
            } else {
                const nameParts = playerSlug.split('-');
                if (nameParts.length < 2) return;
                
                firstName = capitalizeFirst(nameParts[0]);
                lastName = capitalizeFirst(nameParts[1]);
            }
            
            playerQueries.push({
                playerSlug,
                firstName,
                lastName,
                newTeam: teamCode,
                date: tradeDate
            });
        });
    }
    
    for (const query of playerQueries) {
        try {
            const { results } = await db.query(
                'SELECT short_code FROM players WHERE player_id = ?',
                [query.playerSlug]
            );
            
            if (results.length > 0) {
                tradePlayers.push({
                    player_id: query.playerSlug,
                    firstName: query.firstName,
                    lastName: query.lastName,
                    newTeam: query.newTeam,
                    oldTeam: results[0].short_code,
                    date: tradeDate
                });
            }
        } catch (err) {
            console.error(`Error checking player ${query.firstName} ${query.lastName}:`, err);
        }
    }
    return tradePlayers;
}

function correctPlayerName(playerSlug) {
    // Known corrections for problematic player IDs
    const corrections = {
        'j-t-miller': { firstName: 'J.T.', lastName: 'Miller' },
        'drew-o-connor': { firstName: 'Drew', lastName: "O'Connor" },
        'logan-o-connor': { firstName: 'Logan', lastName: "O'Connor" },
        'ryan-o-reilly': { firstName: 'Ryan', lastName: "O'Reilly" },
        'pierre-luc-dubois': { firstName: 'Pierre-Luc', lastName: 'Dubois' },
        'a-j-greer': { firstName: 'A.J.', lastName: 'Greer' },
        'p-o-joseph': { firstName: 'P.O.', lastName: 'Joseph' },
        'k-andre-miller': { firstName: 'K\'Andre', lastName: 'Miller' },
        'j-j-moser': { firstName: 'J.J.', lastName: 'Moser' },
    };
    
    return corrections[playerSlug];
}