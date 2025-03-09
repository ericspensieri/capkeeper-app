import Boom from '@hapi/boom';
import { db } from '../database.js';

export const adminRightsRoute = {
    method: 'POST',
    path: '/api/toggle-admin',
    handler: async (req, h) => {
        try {
            const { user_name, league_id } = req.payload;

            const query = `
                UPDATE team_managed_by
                SET isAdmin = NOT isAdmin
                WHERE league_id = ?
                    AND user_name = ?
            `;
            let result = await db.query(query, [league_id, user_name]);
            return h.response({ message: 'Admin Rights updated', result }).code(200);  

        }
        catch (error) {
            console.error('Error handling request:', error);
            return h.response('An internal error occurred').code(500); 
        }
    }
};