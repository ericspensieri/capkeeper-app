import Boom from '@hapi/boom';
import { db } from '../database.js';

export const submitProtectionsRoute = {
    method: 'POST',
    path: '/api/{league_id}/{team_id}/protection-sheet',
    handler: async (req, h) => {
        const team_id = req.params.team_id;
        const league_id = req.params.league_id;
        const year = req.query.year;

        try {
            const checkSheetQuery = `
                SELECT sheet_id 
                FROM protection_sheets 
                WHERE league_id = ? AND year = ? AND team_id = ? 
                LIMIT 1
            `;
            
            const existingSheet = await db.query(checkSheetQuery, [league_id, year, team_id]);
            let sheet_id;
            
            if (existingSheet.results.length > 0) {
                sheet_id = existingSheet.results[0].sheet_id;
            } else {
                const createSheetQuery = `
                    INSERT INTO protection_sheets (league_id, team_id, year, status)
                    VALUES (?, ?, ?, 'saved')
                `;
                await db.query(createSheetQuery, [league_id, team_id, year]);
                
                const retrieveIdQuery = `
                    SELECT sheet_id 
                    FROM protection_sheets 
                    WHERE league_id = ? AND year = ? AND team_id = ? 
                    ORDER BY sheet_id DESC LIMIT 1
                `;
                const idResult = await db.query(retrieveIdQuery, [league_id, year, team_id]);
                sheet_id = idResult.results[0].sheet_id;
            }

            const { players } = req.payload;
            const deleteQuery = `
                DELETE FROM protected_players 
                WHERE sheet_id = ?
            `;
            await db.query(deleteQuery, [sheet_id]);

            if (players && players.length > 0) {
                const insertAssetQuery = `
                    INSERT INTO protected_players (sheet_id, player_id, onBench, isFranchise)
                    VALUES (?, ?, ?, ?);
                `;

                for (const player of players) {
                    await db.query(insertAssetQuery, [
                        sheet_id,
                        player.player_id,
                        player.onBench,
                        player.isFranchise || false,
                    ]);
                }
            }

            return h.response({ 
                message: 'Protection sheet submitted successfully.',
                sheet_id: sheet_id
            }).code(201);

        } catch (error) {
            console.error('Error submitting protection sheet:', error);
            return h.response(error.message).code(500);
        }
    }
};