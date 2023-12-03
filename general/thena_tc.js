const { ethCall } = MuonAppUtils

class AccountManager {
    static PERP_MANAGER_ABI = [{ "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }], "name": "idToTradingCompetition", "outputs": [{ "components": [{ "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "uint256", "name": "entryFee", "type": "uint256" }, { "internalType": "uint256", "name": "MAX_PARTICIPANTS", "type": "uint256" }, { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "tradingCompetition", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "description", "type": "string" }, { "components": [{ "internalType": "uint256", "name": "startTimestamp", "type": "uint256" }, { "internalType": "uint256", "name": "endTimestamp", "type": "uint256" }, { "internalType": "uint256", "name": "registrationStart", "type": "uint256" }, { "internalType": "uint256", "name": "registrationEnd", "type": "uint256" }], "internalType": "struct ITradingCompetitionManager.TimestampInfo", "name": "timestamp", "type": "tuple" }, { "components": [{ "internalType": "bool", "name": "win_type", "type": "bool" }, { "internalType": "uint256[]", "name": "weights", "type": "uint256[]" }, { "internalType": "uint256", "name": "totalPrize", "type": "uint256" }, { "internalType": "uint256", "name": "owner_fee", "type": "uint256" }, { "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "host_contribution", "type": "uint256" }], "internalType": "struct ITradingCompetitionManager.Prize", "name": "prize", "type": "tuple" }, { "components": [{ "internalType": "uint256", "name": "starting_balance", "type": "uint256" }, { "internalType": "uint256[]", "name": "pairIds", "type": "uint256[]" }], "internalType": "struct ITradingCompetitionManager.CompetitionRules", "name": "competitionRules", "type": "tuple" }], "internalType": "struct ITradingCompetitionManager.TC", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }]
    static ACCOUNT_MANAGER_ABI = []

    static perpManagerAddress = "0x09240b9c7977f7DCd65bf8A23B29f51f5381a64C"
    static defaultChainId = 56

    static async getAccountManager(idCounter) {
        const { tradingCompetition } = await ethCall(perpManagerAddress, 'idToTradingCompetition', [idCounter], AccountManager.PERP_MANAGER_ABI, AccountManager.defaultChainId);
        return tradingCompetition;
    }

    constructor(address) {
        this.address = address;
    }
}

const ThenaTCApp = {
    APP_NAME: 'thena_tc',

    onRequest: async function (request) {
        let { method, data: { params } } = request;

        let { owner, idCounter } = params

        switch (method) {
            case 'info':
                // gets AccountManager address and create instance of it
                const accountManager = new AccountManager(await AccountManager.getAccountManager(idCounter));
                // checks if user is valid
                const isValid = await accountManager.isAccountValid(owner);
                if (!isValid) throw { message: "NOT_VALID_USER" }
                // gets final balance of user
                const finalBalance = await accountManager.getBalanceOfUser(owner);
                // gets user info from subgraph
                const { startingBalance, depositFromOwner, depositNotFromOwner } = await this.getInfo(owner, idCounter);
                // returns outputs
                return {
                    finalBalance,
                    startingBalance,
                    depositFromOwner,
                    depositNotFromOwner,
                };
            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'info':
                const {
                    finalBalance,
                    startingBalance,
                    depositFromOwner,
                    depositNotFromOwner,
                } = result;
                return [
                    { type: 'uint256', value: finalBalance },
                    { type: 'uint256', value: startingBalance },
                    { type: 'uint256', value: depositFromOwner },
                    { type: 'uint256', value: depositNotFromOwner },
                ]
            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = ThenaTCApp
