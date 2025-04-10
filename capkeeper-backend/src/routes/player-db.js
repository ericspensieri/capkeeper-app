import Boom from '@hapi/boom';
import { db } from '../database.js';

export const playerDatabaseRoute = {
    method: 'GET',
    path: '/api/{league_id}/players',
    handler: async (req, h) => {
        const league_id = req.params.league_id;;

        try {
            let players;
            
            const { results } = await db.query( 
                `SELECT 
                    p.*, 
                    pob.isRookie, 
                    t.team_name AS owned_by, 
                    nl.logo 
                FROM nhl_logos nl
                    JOIN players p ON p.short_code = nl.short_code 
                    LEFT JOIN player_owned_by pob ON p.player_id = pob.player_id
                    LEFT JOIN teams t ON pob.team_id = t.team_id
                    LEFT JOIN leagues l ON t.league_id = l.league_id AND l.league_id = ?
                WHERE
                    (l.league_id = ? OR l.league_id IS NULL);`,
                [league_id, league_id]
            );
            players = results;

            return { players };

        } catch (err) {
            console.error(err);
            throw Boom.internal('Internal Server Error');
        }
    }
};