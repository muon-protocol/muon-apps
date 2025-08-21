const { ethCall, axios } = MuonAppUtils

const PERP_MANAGER_ABI = [{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"idToTradingCompetitionAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]
const ACCOUNT_MANAGER_ABI = [{"inputs":[],"name":"getWeightsLength","outputs":[{"internalType":"uint256","name":"length","type":"uint256"}],"stateMutability":"view","type":"function"}];

const perpManagerAddress = "0x66dBEAba55E1D46507a244249dcB8562c12D9ABe"
const defaultChainId = 56

/**
 * @title Thena Trading Competition Test Environment
 * @dev This module provides functionality for managing and querying trading competition data
 */
module.exports  = {
    APP_NAME: 'thena_tc_testenv',
    useFrost: false,

    /**
     * @dev Executes a POST request to the subgraph endpoint
     * @param {string} query - GraphQL query string
     * @param {string} subgraphEndpoint - URL of the subgraph endpoint
     * @return {Object} Parsed response data
     */
    postQuery: async function (query, subgraphEndpoint) {
        const result = await axios.post(subgraphEndpoint, {
            query: query
        })

        const data = result.data

        if (data.errors) {
            throw data.errors
        }

        return data.data
    },

    /**
     * @dev Retrieves the trading competition address for a given ID
     * @param {number} tcId - Trading competition ID
     * @return {string} Trading competition address
     */
    _getTradingCompetitionAddress: async function (tcId) {
        const tradingCompetition = await ethCall(perpManagerAddress, 'idToTradingCompetitionAddress', [tcId], PERP_MANAGER_ABI, defaultChainId);
        return tradingCompetition;
    },

    /**
     * @dev Gets the length of weights for a trading competition
     * @param {number} tcId - Trading competition ID
     * @return {number} Length of weights
     */
    getWeightsLen: async function (tcId) {
        const tc_address = await this._getTradingCompetitionAddress(tcId);
        const weightsLen = await ethCall(tc_address, 'getWeightsLength', [], ACCOUNT_MANAGER_ABI, defaultChainId);
        return weightsLen;
    },

    /**
     * @dev Calculates the position and tie counter for a participant
     * @param {Array} participants - List of all participants
     * @param {string} owner - Address of the participant
     * @param {number} tcId - Trading competition ID
     * @return {Object} Position and tie counter
     */
    getPositionAndTieCounter: async function (participants, owner, tcId) {
        const weightslen = await this.getWeightsLen(tcId);

        // Filter valid participants
        const validParticipants = participants.filter(participant => participant.isValid && participant.isValidDeallocate)

        // Check if owner is a valid participant
        const isOwnerValid = validParticipants.some(participant => participant.owner.toLowerCase() === owner.toLowerCase());
        if(!isOwnerValid) throw { message: "OWNER_NOT_VALID" }
        
        // Sort participants by percentage PNL in descending order
        const sortedParticipants = validParticipants.sort((a,b) => parseFloat(b.percentagePnl) - parseFloat(a.percentagePnl))

        // Find the owner's index in the sorted list
        const ownerIndex = sortedParticipants.findIndex(participant => participant.owner.toLowerCase() === owner.toLowerCase());

        // Get the owner's PNL
        const ownerPnl = sortedParticipants[ownerIndex].percentagePnl;

        // Find the first index of participants with the same PNL as the owner
        const firstIndexSamePnl = sortedParticipants.findIndex(participant => participant.percentagePnl === ownerPnl);

        // Count participants with the same PNL as the owner
        const samePnlParticipants = sortedParticipants.filter(participant => participant.percentagePnl === ownerPnl);

        // Calculate tie counter (subtract 1 as the smart contract handles division by 0)
        const tiecounter = samePnlParticipants.length - 1;
        
        // Count participants with higher PNL than the owner
        const higherParticipants = sortedParticipants.filter(participant => parseFloat(participant.percentagePnl) > parseFloat(ownerPnl));

        // Check if the owner is eligible for a prize
        if(firstIndexSamePnl > weightslen || higherParticipants.length >= weightslen) throw { message: "OWNER_NOT_WIN" }

        return {
            position: firstIndexSamePnl,
            tiecounter: tiecounter
        }
    },

    /**
     * @dev Fetches participant information from the subgraph
     * @param {number} tcId - Trading competition ID
     * @return {Object} Participant data
     */
    getInfo: async function (tcId) {
        const subgraphEndpoint = 'https://api.studio.thegraph.com/query/70764/tc-perp-test-subgraph/version/latest'
        const query = `{
        participants(where: {competition_: {idCounter: ${tcId}}})
            {   
                owner
                percentagePnl
                isValid
                isValidDeallocate
            }
        }`;

        const { participants } = await this.postQuery(query, subgraphEndpoint);
        if (participants.length == 0) throw { message: "NO_RECORD_FOR_USER" }

        return {
            participants: participants
        }
    },

    /**
     * @dev Retrieves position information for a participant
     * @param {string} owner - Address of the participant
     * @param {number} tcId - Trading competition ID
     * @return {Object} Position and tie counter
     */
    _info: async function (owner, tcId) {
        const { participants } = await this.getInfo(tcId);
        const { position, tiecounter } = await this.getPositionAndTieCounter(participants, owner, tcId)

        return {
            position: position,
            tiecounter: tiecounter
        }
    },

    /**
     * @dev Handles incoming requests
     * @param {Object} request - Request object
     * @return {Object} Response data
     */
    onRequest: async function (request) {
        let { method, data: { params } } = request;

        let { owner, tcId } = params

        switch (method) {
            case 'position': {
                const {
                    position,
                    tiecounter
                } = await this._info(owner, tcId);

                return {
                    owner,
                    tcId,
                    position,
                    tiecounter
                }
            }
            default:
                throw { message: `invalid method ${method}` }
        }
    },

    /**
     * @dev Prepares parameters for signing
     * @param {Object} request - Request object
     * @param {Object} result - Result object
     * @return {Array} Array of parameters to sign
     */
    signParams: function (request, result) {
        let { method } = request;

        switch (method) {
            case 'position': {
                let { owner, tcId, position, tiecounter} = result
                return [
                    { type: 'address', value: owner },
                    { type: 'uint256', value: tcId },
                    { type: 'uint256', value: position },
                    { type: 'uint256', value: tiecounter },
                ]
            }
            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}
