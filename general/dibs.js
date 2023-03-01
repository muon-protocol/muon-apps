const { axios, ethCall, BN, recoverTypedMessage } = MuonAppUtils

const subgraphUrl = 'https://api.thegraph.com/subgraphs/name/spsina/dibs'
const DibsRandomSeedGenerator = "0xfa200781a931c9F0ef3306092cd4e547772110Ae"
const DRSG_ABI = [{ "inputs": [{ "internalType": "uint32", "name": "roundId_", "type": "uint32" }], "name": "getSeed", "outputs": [{ "internalType": "bool", "name": "fulfilled", "type": "bool" }, { "internalType": "uint256", "name": "seed", "type": "uint256" }], "stateMutability": "view", "type": "function" }]
const Dibs = "0x664cE330511653cB2744b8eD50DbA31C6c4C08ca"
const DIBS_ABI = [{ "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "addressToCode", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" }]
const DibsLottery = "0x287ed50e4c158dac38e1b7e16c50cd1b2551a300"
const DIBS_LOTTERY_ABI = [{ "inputs": [], "name": "winnersPerRound", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }]

module.exports = {
    APP_NAME: 'dibs',

    postQuery: async function (query) {
        const {
            data: { data }
        } = await axios.post(subgraphUrl, {
            query: query
        })

        return data
    },

    getUserBalance: async function (user, token) {
        const query = `{
            userBalance: accumulativeTokenBalances(where: {user: "${user}", token: "${token}"}) {
              id
              user
              token
              amount
            }
          }`

        const data = await this.postQuery(query)

        const userBalance = data.userBalance[0]
        if (userBalance == undefined) throw { message: `Zero balance for this token` }

        return userBalance.amount
    },

    getSeed: async function (roundId) {
        let data
        try {
            data = await ethCall(DibsRandomSeedGenerator, 'getSeed', [roundId], DRSG_ABI, 56)
        }
        catch (e) {
            throw { message: 'FAILED_TO_FETCH_SEED', detail: e.message }
        }
        const { fulfilled, seed } = data
        if (!fulfilled || new BN(seed).eq(new BN(0))) throw { message: `NO_SEED` }
        return new BN(seed)
    },

    createTicketsQuery: function (roundId, lastUser) {
        const query = `{
            userLotteries (
                first: 1000, where: { round: "${roundId}", user_not: "${Dibs}", user_gt: "${lastUser}", tickets_gt: "0"}
                orderBy: user
            ) {
                user,
                tickets
            }
        }`

        return query
    },

    getRoundTickets: async function (roundId) {
        let lastUser = '0x0000000000000000000000000000000000000000'
        let tickets = []
        let walletsCount = 0

        do {
            const query = this.createTicketsQuery(roundId, lastUser)
            const data = await this.postQuery(query)
            if (data.userLotteries.length == 0) break
            data.userLotteries.forEach((el) => tickets.push(...Array(parseInt(el.tickets)).fill(el.user)))
            lastUser = tickets.at(-1)
            walletsCount += data.userLotteries.length
        } while (walletsCount % 1000 == 0)

        if (tickets.length == 0) throw { message: 'NO_TICKETS' }

        return { tickets, walletsCount }
    },

    whoIsWinner: function (seed, tickets) {
        const winnerTicket = seed.mod(new BN(tickets.length))
        return tickets[winnerTicket]
    },

    determineWinners: function (winnersPerRound, tickets, walletsCount, seed) {
        if (walletsCount <= winnersPerRound) return [...new Set(tickets)]
        let winners = []
        for (let i = 0; i < winnersPerRound; i++) {
            const winner = this.whoIsWinner(seed, tickets)
            winners.push(winner)
            tickets = tickets.filter((value) => { return value != winner })
        }

        return winners
    },

    isValidSignature: function (forAddress, time, sign) {
        let typedData = {
            types: {
                EIP712Domain: [{ name: 'name', type: 'string' }],
                Message: [
                    { type: 'address', name: 'user' },
                    { type: 'uint256', name: 'timestamp' }
                ]
            },
            domain: { name: 'Dibs' },
            primaryType: 'Message',
            message: { user: forAddress, timestamp: time }
        }
        let signer = recoverTypedMessage({ data: typedData, sig: sign }, 'v4')

        return signer.toLowerCase() === forAddress.toLowerCase()
    },

    isValidUser: async function (user) {
        const code = await ethCall(Dibs, 'addressToCode', [user], DIBS_ABI, 56)
        if (code == '0x0000000000000000000000000000000000000000000000000000000000000000') return false
        return true
    },

    getTopLeaderBoardN: async function (n, day) {
        const query = `{
            topLeaderBoardN: dailyGeneratedVolumes(first: ${n}, where: {day: ${day}, user_not: "${Dibs}"}, orderBy: amountAsReferrer, orderDirection: desc) {
              id
              user
              amountAsReferrer
              day
            }
        }`

        const data = await this.postQuery(query)

        let topLeaderBoardN = []
        data.topLeaderBoardN.forEach((el) => topLeaderBoardN.push(el.user))

        return topLeaderBoardN

    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'claim':
                let { user, token, time, sign } = params

                if (!sign) throw { message: 'Request signature undefined' }
                if (!this.isValidSignature(user, time, sign)) throw { message: 'Request signature mismatch' }

                if (!await this.isValidUser(user)) throw { message: 'Not an active user' }

                const balance = await this.getUserBalance(user, token)

                return {
                    user, token, balance
                }

            case 'lotteryWinner':
                let { roundId } = params
                const seed = await this.getSeed(roundId)
                const { tickets, walletsCount } = await this.getRoundTickets(roundId)
                const winnersPerRound = await ethCall(DibsLottery, 'winnersPerRound', [], DIBS_LOTTERY_ABI, 56)
                const winners = this.determineWinners(winnersPerRound, tickets, walletsCount, seed)

                return { roundId, winners }

            case 'topLeaderBoardN':
                let { n, day } = params

                const topLeaderBoardN = await this.getTopLeaderBoardN(n, day)

                return { n, day, topLeaderBoardN }

            default:
                throw { message: `Unknown method ${params}` }
        }
    },

    /**
     * List of the parameters that need to be signed. 
     * APP_ID, reqId will be added by the
     * Muon Core and [APP_ID, reqId, … signParams]
     * should be verified on chain.
     */
    signParams: function (request, result) {
        let { method } = request;
        switch (method) {
            case 'claim':
                let { user, token, balance } = result
                return [
                    { type: 'address', value: user },
                    { type: 'address', value: token },
                    { type: 'uint256', value: balance },
                ]

            case 'lotteryWinner':
                let { roundId, winners } = result
                return [
                    { type: 'uint32', value: roundId },
                    { type: 'address[]', value: winners },
                ]

            case 'topLeaderBoardN': {
                let { n, day, topLeaderBoardN } = result
                return [
                    { type: 'uint256', value: n },
                    { type: 'uint256', value: day },
                    { type: 'address[]', value: topLeaderBoardN },
                ]

            }

            default:
                break
        }
    }
}