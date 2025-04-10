import Boom from '@hapi/boom';
import { db } from '../database.js';

export const finalizeProtectionSheetRoute = {
    method: 'POST',
    path: '/api/finalize-sheet/{sheet_id}',
    handler: async (req, h) => {
        try {
            const sheet_id = req.params.sheet_id;
            const status = req.query.status;

            const query = `
                UPDATE protection_sheets
                SET status = ?
                WHERE sheet_id = ?
            `;
            let result = await db.query(query, [status, sheet_id]);

            if (status === 'processed') {
                const players = req.payload.players;
                if (players && players.length > 0) {
                    const insertAssetQuery = `
                        INSERT INTO protected_players (sheet_id, player_id, onBench, isFranchise, isProtected)
                        VALUES (?, ?, 0, 0, 0);
                    `;

                    for (const player of players) {
                        player.player_id;
                        await db.query(insertAssetQuery, [
                            sheet_id,
                            player.player_id,
                        ]);
                    }
                }
            }

            return h.response({ message: 'Protection Sheet Finalized', result }).code(200);  

        }
        catch (error) {
            console.error('Error handling request:', error);
            return h.response('An internal error occurred').code(500); 
        }
    }
};