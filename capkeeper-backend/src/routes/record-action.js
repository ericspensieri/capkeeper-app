import Boom from '@hapi/boom';
import { db } from '../database.js';

export const recordActionRoute = {
    method: 'POST',
    path: '/api/record-action',
    handler: async (req, h) => {
        try {
            const { league_id, message, date, time, user_id, action_type, trade_id, sheet_id } = req.payload;
            let result;
            
            const query = `
            INSERT INTO recent_activity (league_id, message, date, time, user_id, action_type, trade_id, sheet_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            result = await db.query(query, [league_id, message, date, time, user_id, action_type, trade_id, sheet_id]);
            return h.response(result).code(201);

        }
        catch (error) {
            console.error('Error handling new player request:', error);
            return h.response(error.message).code(500);
        }
    }
};