import { teamRosterRoute } from "./team-roster.js";
import { leagueRoute } from "./league.js";
import { playerDatabaseRoute } from "./player-db.js";
import { createPlayerRoute } from "./create-player.js";
import { recordActionRoute } from "./record-action.js";
import { recentActivityRoute } from "./recent-activity.js";
import { loginRoute } from "./login.js";
import { addDropRoute } from "./add-drop.js";
import { uploadFileRoute } from "./upload-file.js";
import { rosterMoveRoute } from "./roster-move.js";
import { editContractRoute } from "./edit-contract.js";
import { recordSessionRoute } from "./record-session.js";
import { editTeamRoute } from "./edit-team-info.js";
import { editUserRoute } from "./edit-user-info.js";
import { sendTradeRoute } from "./trade-sent.js";
import { tradeReviewRoute } from "./trade-review.js";
import { confirmTradeRoute } from "./trade-response.js";
import { leagueHomeRoute } from "./home.js";
import { draftHistoryRoute } from "./draft-history.js";
import { submitProtectionsRoute } from "./submit-protection-sheet.js";
import { loadProtectionsRoute } from "./load-protection-sheet.js";
import { commisssionerHubRoute } from "./commissioner-hub.js";
import { editLeagueRoute } from "./edit-league.js";
import { adminRightsRoute } from "./admin-rights.js";
import { editAssetRoute } from "./edit-asset.js";
import { createDraftRoute } from "./create-draft.js";
import { setDraftOrderRoute } from "./set-draft-order.js";
import { generateFARoute } from "./generate-fas.js";
import { pickHistoryRoute } from "./pick-history.js";
import { resolveTradeConditionRoute } from "./resolve-condition.js";
import { scrapeContractsRoute } from "./scrape-contracts.js";
import { scrapeTradesRoute } from "./scrape-trades.js";

export default [
    leagueRoute,
    leagueHomeRoute,
    teamRosterRoute,
    playerDatabaseRoute,
    createPlayerRoute,
    recordActionRoute,
    recentActivityRoute,
    loginRoute,
    addDropRoute, 
    uploadFileRoute,
    rosterMoveRoute,
    editContractRoute,
    recordSessionRoute,
    editTeamRoute,
    editUserRoute,
    sendTradeRoute,
    tradeReviewRoute,
    confirmTradeRoute,
    draftHistoryRoute,
    submitProtectionsRoute,
    loadProtectionsRoute,
    commisssionerHubRoute,
    editLeagueRoute,
    adminRightsRoute,
    editAssetRoute,
    setDraftOrderRoute,
    createDraftRoute,
    generateFARoute,
    pickHistoryRoute,
    resolveTradeConditionRoute,
    scrapeContractsRoute,
    scrapeTradesRoute
]