import Boom from '@hapi/boom';
import { db } from '../database.js';

export const createPlayerRoute = {
    method: 'POST',
    path: '/api/players/create-player',
    handler: async (req, h) => {
        try {
            const { player_id, first_name, last_name, short_code, position, last_updated, updated_by, aav_current, years_left_current, action } = req.payload;
            let result;

            let aav = 0;
            if (aav_current !== undefined) {
                aav = aav_current;
            }

            let yl = 0;
            if (years_left_current !== undefined) {
                yl = years_left_current;
            }
            
            if (action === 'add') {
                const query = `
                INSERT INTO players (player_id, first_name, last_name, short_code, position, years_left_current, aav_current, last_updated, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                result = await db.query(query, [player_id, first_name, last_name, short_code, position, yl, aav, last_updated, updated_by]);
                return h.response(result).code(201);
            }
            if (action === 'edit') {
                const query = `
                UPDATE players
                SET
                    first_name = ?,
                    last_name = ?,
                    short_code = ?,
                    position = ?,
                    last_updated = ?,
                    updated_by = ?
                WHERE player_id = ?
                `;
                result = await db.query(query, [first_name, last_name, short_code, position, last_updated, updated_by, player_id]);
                return h.response(result).code(200);
            }
            else {
                return h.response('Invalid action specified').code(400);
            }
        }
        catch (error) {
            console.error('Error handling new player request:', error);
            return h.response(error.message).code(500);
        }
    }
};