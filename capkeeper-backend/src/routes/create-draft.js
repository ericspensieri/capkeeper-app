import Boom from '@hapi/boom';
import { db } from '../database.js';

export const createDraftRoute = {
    method: 'POST',
    path: '/api/create-draft',
    handler: async (req, h) => {
        try {
            const { year, type, league_id, draft_picks } = req.payload;

            const createDraftQuery = `
                INSERT INTO drafts (year, type, league_id)
                VALUES (?, ?, ?)
            `;

            const retrieveIdQuery = `
                SELECT draft_id 
                FROM drafts 
                WHERE league_id = ? AND year = ? AND type = ? ORDER BY draft_id DESC LIMIT 1
            `;

            await db.query(createDraftQuery, [year, type, league_id]);
            const idResult = await db.query(retrieveIdQuery, [league_id, year, type]);
            const draft_id = idResult.results[0].draft_id;
           
            if (draft_picks && draft_picks.length > 0) {
                for (const pick of draft_picks) {
                    const { round, assigned_to } = pick;

                        const draftPickQuery = `
                        INSERT INTO draft_picks (draft_id, round, assigned_to)
                        VALUES (?, ?, ?)
                        `;
                        await db.query(draftPickQuery, [draft_id, round, assigned_to]);
                }
            } 

            return h.response({ message: 'Draft created successfully', draft_id }).code(201);

        } catch (error) {
            console.error('Error creating draft:', error);
            
            if (error.code === 'ER_DUP_ENTRY') {
                throw Boom.conflict('A draft already exists for this league, year, and type combination');
            }

            if (error.isBoom) {
                throw error;
            }

            throw Boom.internal('Error creating draft');
        }
    }
};