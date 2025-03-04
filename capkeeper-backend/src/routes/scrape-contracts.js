import Boom from '@hapi/boom';
import { db } from '../database.js';
import * as cheerio from 'cheerio';
import axios from 'axios';

const standardizePosition = (position) => {
    if (position.includes('RD') || position.includes('LD')) return 'D';
    if (position.includes('RW') || position.includes('LW') || position.includes('C')) return 'F';
    if (position.includes('G')) return 'G';
    return 'F'; 
};

export const scrapeContractsRoute = {
    method: 'GET',
    path: '/api/scrape-contracts',
    handler: async (req, h) => {
        const last_updated = req.query.date;
        const forceAll = req.query.forceAll === 'true';
        const targetUrl = 'https://capwages.com/signings';
        const testMode = false;

        try {
            const response = await axios.get(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            const tableData = [];
            $('main table tbody tr').each((i, row) => {
                
                if (testMode && tableData.length >= 5) {
                    return false;
                }

                const cells = $(row).find('td');
                
                const fullName = $(cells[0]).text().trim();
                const [lastName, firstName] = fullName.split(', ');
                const contractType = $(cells[5]).text().trim();
                
                // Skip 2-way contracts
                if (contractType.toLowerCase().includes('2-way')) {
                    return;
                }
                
                const player = {
                    player_id: `${firstName}-${lastName}`.toLowerCase(),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    age: parseInt($(cells[1]).text().trim()),
                    position: $(cells[2]).text().trim(),
                    short_code: $(cells[3]).text().trim(),
                    contractType: contractType,
                    years: parseInt($(cells[6]).text().trim()),
                    aav: parseInt($(cells[7]).text().trim().replace(/[$,]/g, ''))
                };
                
                tableData.push(player);
            });

            const logs = [];
            let breakLoop = false;

            for (const player of tableData) {
                
                if (breakLoop && !forceAll) {
                    console.log(`Skipping remaining players - already processed the latest contracts`);
                    break;
                }

                try {
                    const { results: [existingPlayer] } = await db.query(
                        'SELECT * FROM players WHERE player_id = ?',
                        [player.player_id]
                    );

                    if (existingPlayer) {

                        let contractMatched = false;
                        if (player.contractType === 'Std (Ext)') {
                            contractMatched = 
                                existingPlayer.years_left_next === player.years && 
                                existingPlayer.aav_next === player.aav &&
                                existingPlayer.short_code === player.short_code;
                        } else {
                            contractMatched = 
                                existingPlayer.years_left_current === player.years && 
                                existingPlayer.aav_current === player.aav &&
                                existingPlayer.short_code === player.short_code;
                        }

                        if (contractMatched && !forceAll) {
                            breakLoop = true;
                            continue;
                        }

                        let updateQuery;
                        let updateParams;

                        if (player.contractType === 'Std (Ext)') {
                            updateQuery = `
                                UPDATE players 
                                SET years_left_next = ?,
                                    aav_next = ?,
                                    short_code = ?,
                                    age = ?,
                                    expiry_status = 'UFA',
                                    contract_status = 'Active',
                                    updated_by = 'Capkeeper Bot',
                                    last_updated = ?
                                WHERE player_id = ?
                            `;
                        } else if (player.contractType === 'Std' || player.contractType === 'ELC' || player.contractType === '35+ Contract') {
                            updateQuery = `
                                UPDATE players 
                                SET years_left_current = ?,
                                    aav_current = ?,
                                    short_code = ?,
                                    age = ?,
                                    expiry_status = 'UFA',
                                    contract_status = 'Active',
                                    updated_by = 'Capkeeper Bot',
                                    last_updated = ?
                                WHERE player_id = ?
                            `;
                        } else {
                            logs.push({
                                status: 'error',
                                player: `${player.firstName} ${player.lastName}`,
                                reason: `Unhandled contract type: ${player.contractType}`
                            });
                            continue;
                        }

                        updateParams = [
                            player.years,
                            player.aav,
                            player.short_code,
                            player.age,
                            last_updated,
                            existingPlayer.player_id
                        ];

                        await db.query(updateQuery, updateParams);

                        logs.push({
                            status: 'updated',
                            player: `${player.firstName} ${player.lastName}`,
                            team: player.short_code,
                            salary: player.aav,
                            years: player.years,
                            contractType: player.contractType
                        });
                    } else {
                        const standardPosition = standardizePosition(player.position);
                        
                        const insertQuery = `
                            INSERT INTO players (
                                player_id,
                                first_name,
                                last_name,
                                position,
                                short_code,
                                age,
                                years_left_current,
                                aav_current,
                                last_updated,
                                contract_status,
                                updated_by
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'Capkeeper Bot')
                        `;

                        const insertParams = [
                            player.player_id,
                            player.firstName,
                            player.lastName,
                            standardPosition,
                            player.short_code,
                            player.age,
                            player.years,
                            player.aav,
                            last_updated
                        ];

                        await db.query(insertQuery, insertParams);

                        logs.push({
                            status: 'created',
                            player: `${player.firstName} ${player.lastName}`,
                            position: standardPosition,
                            team: player.short_code,
                            contractType: player.contractType,
                            years: player.years,
                            salary: player.aav
                        });
                    }
                } catch (err) {
                    console.error(`Error processing player ${player.firstName} ${player.lastName}:`, err);
                    logs.push({
                        status: 'error',
                        player: `${player.firstName} ${player.lastName}`,
                        error: err.message
                    });
                }
            }

            return {
                success: true,
                rows: logs,
                totalProcessed: logs.length,
                updates: logs.filter(r => r.status === 'updated').length,
                creates: logs.filter(r => r.status === 'created').length,
                skipped: logs.filter(r => r.status === 'skipped').length,
                errors: logs.filter(r => r.status === 'error').length
            };

        } catch (err) {
            console.error('Scraping error:', err);
            throw Boom.internal('Failed to scrape data', err);
        }
    }
};