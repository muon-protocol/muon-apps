const { ethCall, axios, BN } = MuonAppUtils

class AccountManager {
    static PERP_MANAGER_ABI = [{ "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }], "name": "idToTradingCompetition", "outputs": [{ "components": [{ "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "uint256", "name": "entryFee", "type": "uint256" }, { "internalType": "uint256", "name": "MAX_PARTICIPANTS", "type": "uint256" }, { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "tradingCompetition", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "description", "type": "string" }, { "components": [{ "internalType": "uint256", "name": "startTimestamp", "type": "uint256" }, { "internalType": "uint256", "name": "endTimestamp", "type": "uint256" }, { "internalType": "uint256", "name": "registrationStart", "type": "uint256" }, { "internalType": "uint256", "name": "registrationEnd", "type": "uint256" }], "internalType": "struct ITradingCompetitionManager.TimestampInfo", "name": "timestamp", "type": "tuple" }, { "components": [{ "internalType": "bool", "name": "win_type", "type": "bool" }, { "internalType": "uint256[]", "name": "weights", "type": "uint256[]" }, { "internalType": "uint256", "name": "totalPrize", "type": "uint256" }, { "internalType": "uint256", "name": "owner_fee", "type": "uint256" }, { "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "host_contribution", "type": "uint256" }], "internalType": "struct ITradingCompetitionManager.Prize", "name": "prize", "type": "tuple" }, { "components": [{ "internalType": "uint256", "name": "starting_balance", "type": "uint256" }, { "internalType": "uint256[]", "name": "pairIds", "type": "uint256[]" }], "internalType": "struct ITradingCompetitionManager.CompetitionRules", "name": "competitionRules", "type": "tuple" }], "internalType": "struct ITradingCompetitionManager.TC", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }]
    static ACCOUNT_MANAGER_ABI = [{ "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "getQuotesLength", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }, { "internalType": "uint256", "name": "start", "type": "uint256" }, { "internalType": "uint256", "name": "size", "type": "uint256" }], "name": "isAccountValid", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }], "name": "getAccountOf", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }], "name": "getBalanceOfUser", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }]

    static perpManagerAddress = "0x5b86dDF88d9F75ba794a410532ae4ae9a0985500"
    static defaultChainId = 56

    static async getAccountManager(tcId) {
        const { tradingCompetition } = await ethCall(AccountManager.perpManagerAddress, 'idToTradingCompetition', [tcId], AccountManager.PERP_MANAGER_ABI, AccountManager.defaultChainId);
        return tradingCompetition;
    }

    constructor(address, tcId) {
        this.address = address;
        this.tcId = tcId;
    }

    async getQuotesCount(owner) {
        const account = await ethCall(this.address, 'getAccountOf', [owner], AccountManager.ACCOUNT_MANAGER_ABI, AccountManager.defaultChainId);
        const quotesCount = await ethCall(this.address, 'getQuotesLength', [account], AccountManager.ACCOUNT_MANAGER_ABI, AccountManager.defaultChainId);
        return quotesCount;
    }

    async _isAccountValid(owner, start, size) {
        const isValid = await ethCall(this.address, 'isAccountValid', [owner, start, size], AccountManager.ACCOUNT_MANAGER_ABI, AccountManager.defaultChainId);
        return isValid
    }

    async isAccountValid(owner) {
        const quotesCount = await this.getQuotesCount(owner);
        const size = 50;

        let isValid = true;
        for (let start = 0; start < quotesCount & isValid; start += size) {
            isValid = await this._isAccountValid(owner, start, size);
        }
        return isValid;
    }

    async getBalanceOfUser(owner) {
        const balance = ethCall(this.address, 'getBalanceOfUser', [owner], AccountManager.ACCOUNT_MANAGER_ABI, AccountManager.defaultChainId);
        return balance
    }
}

const ThenaTCApp = {
    APP_NAME: 'thena_tc',

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



    getInfo: async function (owner, tcId) {
        const subgraphEndpoint = 'https://api.thegraph.com/subgraphs/name/spsina/thenatc'
        const query = `{
        participants(where: {owner: "${owner}", competition_: {idCounter: ${tcId}}})
            {
                depositFromOwner
                depositNotFromOwner
                competition {
                    startingBalance
                }
            }
        }`;

        const { participants } = await this.postQuery(query, subgraphEndpoint);
        if (participants.length == 0) throw { message: "NO_RECORD_FOR_USER" }
        if (participants.length > 1) throw { message: "MULTIPLE_RECORD_FOR_USER" }

        return {
            startingBalance: participants[0].competition.startingBalance,
            depositFromOwner: participants[0].depositFromOwner,
            depositNotFromOwner: participants[0].depositNotFromOwner,
        }
    },

    _info: async function (owner, tcId) {
        // gets AccountManager address and create instance of it
        const accountManager = new AccountManager(await AccountManager.getAccountManager(tcId), tcId);
        // checks if user is valid
        const isValid = await accountManager.isAccountValid(owner);
        if (!isValid) throw { message: "NOT_VALID_USER" }
        // gets final balance of user
        const finalBalance = await accountManager.getBalanceOfUser(owner);
        // gets user info from subgraph
        const { startingBalance, depositFromOwner, depositNotFromOwner } = await this.getInfo(owner, tcId);
        // returns outputs
        return {
            finalBalance,
            startingBalance,
            depositFromOwner,
            depositNotFromOwner,
        };
    },

    calculatePnl: function (finalBalance, startingBalance, depositFromOwner, depositNotFromOwner) {
        const balance0 = new BN(depositFromOwner).add(new BN(startingBalance))
        const balance1 = new BN(finalBalance).sub(new BN(depositNotFromOwner))
        const balanceChange = balance1.sub(balance0)
        const pnl = balanceChange.mul(new BN(10000)).div(balance0)
        return pnl
    },

    onRequest: async function (request) {
        let { method, data: { params } } = request;

        let { owner, tcId } = params

        let result = {
            owner,
            tcId,
        }

        switch (method) {
            case 'info': {
                // get info
                const info = await this._info(owner, tcId);
                return Object.assign(result, info);
            }
            case 'pnl': {
                // gets required info
                const {
                    finalBalance,
                    startingBalance,
                    depositFromOwner,
                    depositNotFromOwner,
                } = await this._info(owner, tcId);
                // calculates pnl
                const pnl = this.calculatePnl(finalBalance, startingBalance, depositFromOwner, depositNotFromOwner)
                // returns result
                return Object.assign(result, { pnl })
            }
            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        const {
            owner,
            tcId,
        } = result;

        const baseResult = [
            { type: 'address', value: owner },
            { type: 'uint256', value: tcId },
        ]

        switch (request.method) {
            case 'info': {
                const {
                    finalBalance,
                    startingBalance,
                    depositFromOwner,
                    depositNotFromOwner,
                } = result;

                return [
                    ...baseResult,
                    { type: 'uint256', value: finalBalance },
                    { type: 'uint256', value: startingBalance },
                    { type: 'uint256', value: depositFromOwner },
                    { type: 'uint256', value: depositNotFromOwner },
                ]
            }
            case 'pnl': {
                const { pnl } = result;

                return [
                    ...baseResult,
                    { type: 'int256', value: pnl },
                ]
            }
            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = ThenaTCApp
