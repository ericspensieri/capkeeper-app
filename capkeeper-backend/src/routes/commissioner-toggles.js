import Boom from '@hapi/boom';
import { db } from '../database.js';

export const commissionerToggleRoute = {
    method: 'POST',
    path: '/api/toggle-setting',
    handler: async (req, h) => {
        try {
            const { column, league_id } = req.payload;
            
            const allowedColumns = ['inOffseason', 'tradingEnabled', 'protectionIsPublic'];
            
            if (!allowedColumns.includes(column)) {
                return Boom.badRequest(`Invalid column: ${column}`);
            }

            const query = `
                UPDATE leagues
                SET ${column} = NOT ${column}
                WHERE league_id = ?
            `;
            
            let result = await db.query(query, [league_id]);
            return h.response({ 
                message: `League settings updated successfully`,
                result 
            }).code(200);  
        }
        catch (error) {
            console.error('Error handling request:', error);
            return Boom.internal('An error occurred while updating league settings');
        }
    }
};