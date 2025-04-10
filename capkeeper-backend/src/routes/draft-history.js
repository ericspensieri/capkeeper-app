import Boom from '@hapi/boom';
import { db } from '../database.js';

export const draftHistoryRoute = {
    method: 'GET',
    path: '/api/{league_id}/draft',
    handler: async (req, h) => {
        const league_id = req.params.league_id;
        const year = req.query.year;
        const draft_id = req.query.draft_id;

        try {
            // If draft_id is provided, retrieve a single draft by ID
            if (draft_id) {
                const { results: draftPicks } = await db.query( 
                    `SELECT d.*, dp.*, p.first_name AS player_first_name, p.last_name AS player_last_name, 
                    p.short_code AS player_short_code, p.position AS player_position 
                    FROM drafts d 
                        JOIN draft_picks dp ON d.draft_id = dp.draft_id 
                        LEFT JOIN players p ON dp.player_taken = p.player_id
                    WHERE d.draft_id = ?
                    ORDER BY dp.pick_number`,
                    [draft_id]
                );

                const { results: draft } = await db.query( 
                    `SELECT *
                    FROM drafts
                    WHERE draft_id = ?`,
                    [draft_id]
                );

                if (draft.length === 0) {
                    throw Boom.notFound('Draft not found');
                }

                return { 
                    draft: draft[0], 
                    draftPicks 
                };
            } 

            else if (year) {
                const { results: draftPicks } = await db.query( 
                    `SELECT d.*, dp.*, p.first_name AS player_first_name, p.last_name AS player_last_name, 
                    p.short_code AS player_short_code, p.position AS player_position 
                    FROM drafts d 
                        JOIN draft_picks dp ON d.draft_id = dp.draft_id 
                        LEFT JOIN players p ON dp.player_taken = p.player_id
                    WHERE d.league_id = ?
                    AND d.year = ?
                    ORDER BY d.type, dp.pick_number`,
                    [league_id, year]
                );

                const { results: drafts } = await db.query( 
                    `SELECT d.*
                    FROM drafts d 
                    WHERE d.league_id = ?
                    AND (d.status = 'complete' OR d.status = 'order-set')`,
                    [league_id]
                );

                return { draftPicks, drafts };
            } else {
                throw Boom.badRequest('Either draft_id or year query parameter is required');
            }
        } catch (err) {
            console.error(err);
            if (Boom.isBoom(err)) {
                throw err;
            }
            throw Boom.internal('Internal Server Error');
        }
    }
};