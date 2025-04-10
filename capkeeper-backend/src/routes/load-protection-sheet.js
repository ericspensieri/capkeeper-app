import Boom from '@hapi/boom';
import { db } from '../database.js';

export const loadProtectionsRoute = {
    method: 'GET',
    path: '/api/{league_id}/{team_id}/protection-sheet',
    handler: async (req, h) => {
        const team_id = req.params.team_id;
        const league_id = req.params.league_id;
        const year = req.query.year;

        try {
            const { results: players } = await db.query( 
                `SELECT p.*, pp.onBench, pp.isFranchise
                FROM protection_sheets ps JOIN protected_players pp
                    ON ps.sheet_id = pp.sheet_id
                    JOIN players p
                    ON p.player_id = pp.player_id
                WHERE ps.league_id = ?
                    AND ps.team_id = ?
                    AND ps.year = ?
                    AND pp.isProtected = 1
                    `, [league_id, team_id, year]
            );

            const { results: sheets } = await db.query( 
                `SELECT * from protection_sheets
                WHERE league_id = ?
                    AND team_id = ?
                    AND year = ?
                LIMIT 1
                    `, [league_id, team_id, year]
            );
            const sheet = sheets[0]

            return { players, sheet };

        } catch (err) {
            console.error(err);
            throw Boom.internal('Internal Server Error');
        }
    }
};