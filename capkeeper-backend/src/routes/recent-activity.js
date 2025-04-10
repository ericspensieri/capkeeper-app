import Boom from '@hapi/boom';
import { db } from '../database.js';

export const recentActivityRoute = {
    method: 'GET',
    path: '/api/{league_id}/activity-log',
    handler: async (req, h) => {
        const league_id = req.params.league_id;
        const { start, end } = req.query;

        if (!start || !end) {
            throw Boom.badRequest('Both start and end date parameters are required.');
        }

        try {
            const { results: action_log } = await db.query( 
                `SELECT * FROM recent_activity
                WHERE league_id = ?
                    AND date BETWEEN ? AND ?
                ORDER BY date DESC, time DESC`,
                 [league_id, start, end]
            );

            const { results: users } = await db.query( 
                `SELECT first_name, last_name, u.user_name 
                FROM users u JOIN team_managed_by tmb
                    ON u.user_name = tmb.user_name
                WHERE tmb.league_id = ?`,
                [league_id]
            );

            const { results: tradeItems } = await db.query(
                `SELECT ti.*, p.first_name, p.last_name, p.aav_current, p.years_left_current, p.position, p.short_code,
                    CASE 
                        WHEN ti.asset_type = 'draft_pick' THEN d.year
                        WHEN ti.asset_type = 'fa' THEN fa.year
                        ELSE NULL
                    END AS year,
                    dp.round, 
                    dp.pick_number, 
                    d.type, 
                    fa.week
                FROM trade_items ti
                    LEFT JOIN players p ON ti.asset_type = 'player' AND ti.player_id = p.player_id
                    LEFT JOIN draft_picks dp ON ti.asset_type = 'draft_pick' AND ti.draft_pick_id = dp.asset_id
                    LEFT JOIN drafts d ON d.draft_id = dp.draft_id
                    LEFT JOIN fa_picks fa ON ti.asset_type = 'fa' AND ti.fa_id = fa.asset_id
                WHERE ti.trade_id IN (SELECT DISTINCT trade_id
                        FROM recent_activity
                        WHERE league_id = ?
                            AND date BETWEEN ? AND ?
                            AND trade_id IS NOT NULL)`,
                [league_id, start, end]
            );

            const { results: sheetItems } = await db.query(
                `SELECT pp.player_id, p.first_name, p.last_name, p.position, p.short_code, pp.sheet_id
                FROM protected_players pp JOIN players p ON pp.player_id = p.player_id
                WHERE pp.isProtected = 0
                    AND pp.sheet_id IN (SELECT DISTINCT sheet_id
                        FROM recent_activity
                        WHERE league_id = ?
                            AND date BETWEEN ? AND ?
                            AND sheet_id IS NOT NULL)
                ORDER BY p.aav_current DESC
                `, [league_id, start, end]
            )

            return { action_log, users, tradeItems, sheetItems };

        } catch (err) {
            console.error(err);
            throw Boom.internal('Internal Server Error');
        }
    }
};
