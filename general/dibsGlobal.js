const { axios, ethCall, BN, recoverTypedMessage } = MuonAppUtils

const DIBS_ABI = [{ "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "addressToCode", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" }]
const DIBS_LOTTERY_ABI = [{ "inputs": [], "name": "winnersPerRound", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }]

const DibsRepository = "0x1370Ff0e5CC846a95f34FE50aD90daad17022797"
const DIBS_REPO_ABI = [{ "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "projects", "outputs": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "address", "name": "dibs", "type": "address" }, { "internalType": "string", "name": "subgraphEndpoint", "type": "string" }, { "internalType": "uint32", "name": "firstRoundStartTime", "type": "uint32" }, { "internalType": "uint32", "name": "roundDuration", "type": "uint32" }, { "internalType": "bool", "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "roundId", "type": "bytes32" }], "name": "getSeed", "outputs": [{ "internalType": "bool", "name": "fulfilled", "type": "bool" }, { "internalType": "uint256", "name": "seed", "type": "uint256" }], "stateMutability": "view", "type": "function" }]

module.exports = {
    APP_NAME: 'dibsGlobal',

    postQuery: async function (query, subgraphEndpoint) {
        const {
            data: { data }
        } = await axios.post(subgraphEndpoint, {
            query: query
        })

        return data
    },

    getUserBalance: async function (user, token, subgraphEndPoint) {
        const query = `{
            userBalance: accumulativeTokenBalances(where: {user: "${user}", token: "${token}"}) {
              id
              user
              token
              amount
            }
          }`

        const data = await this.postQuery(query, subgraphEndPoint)

        const userBalance = data.userBalance[0]
        if (userBalance == undefined) throw { message: `Zero balance for this token` }

        return userBalance.amount
    },

    getSeed: async function (roundId) {
        let data
        try {
            data = await ethCall(DibsRepository, 'getSeed', [roundId], DIBS_REPO_ABI, 137)
        }
        catch (e) {
            throw { message: 'FAILED_TO_FETCH_SEED', detail: e.message }
        }
        const { fulfilled, seed } = data
        if (!fulfilled || new BN(seed).eq(new BN(0))) throw { message: `NO_SEED` }
        return new BN(seed)
    },

    createTicketsQuery: function (round, lastUser) {
        const query = `{
            userLotteries (
                first: 1000, where: { round: "${round}", user_not: "${dibs}", user_gt: "${lastUser}", tickets_gt: "0"}
                orderBy: user
            ) {
                user,
                tickets
            }
        }`

        return query
    },

    getRoundTickets: async function (round, subgraphEndpoint) {
        let lastUser = '0x0000000000000000000000000000000000000000'
        let tickets = []
        let walletsCount = 0

        do {
            const query = this.createTicketsQuery(round, lastUser)
            const data = await this.postQuery(query, subgraphEndpoint)
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

    isValidUser: async function (dibs, user, chainId) {
        const code = await ethCall(dibs, 'addressToCode', [user], DIBS_ABI, chainId)
        if (code == '0x0000000000000000000000000000000000000000000000000000000000000000') return false
        return true
    },

    getTopLeaderBoardN: async function (n, day, subgraphEndPoint) {
        const query = `{
            topLeaderBoardN: dailyGeneratedVolumes(first: ${n}, where: {day: ${day}, user_not: "${dibs}"}, orderBy: amountAsReferrer, orderDirection: desc) {
              id
              user
              amountAsReferrer
              day
            }
        }`

        const data = await this.postQuery(query, subgraphEndPoint)

        let topLeaderBoardN = []
        data.topLeaderBoardN.forEach((el) => topLeaderBoardN.push(el.user))

        return topLeaderBoardN

    },

    fetchProject: async function (projectId) {
        const { dibs, chainId, subgraphEndPoint } = await ethCall(DibsRepository, 'projects', [projectId], DIBS_REPO_ABI, 137)
        return { dibs, chainId, subgraphEndPoint }
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'claim': {
                let { projectId, user, token, time, sign } = params

                if (!sign) throw { message: 'Request signature undefined' }
                if (!this.isValidSignature(user, time, sign)) throw { message: 'Request signature mismatch' }

                const { dibs, chainId, subgraphEndpoint } = await this.fetchProject(projectId)
                if (!await this.isValidUser(dibs, user, chainId)) throw { message: 'Not an active user' }

                const balance = await this.getUserBalance(user, token, subgraphEndpoint)

                return {
                    projectId, user, token, balance
                }
            }

            case 'lotteryWinner': {
                let { projectId, round } = params
                const { dibs, chainId, subgraphEndpoint } = await this.fetchProject(projectId)
                const { tickets, walletsCount } = await this.getRoundTickets(round, subgraphEndpoint)
                const { seed, roundId } = await this.fetchSeed(projectNumber, round)
                const winnersPerRound = await this.fetchWinnersPerRound(dibs, chainId)
                const winners = this.determineWinners(winnersPerRound, tickets, walletsCount, seed)

                return { roundId, winners }
            }

            case 'topLeaderBoardN':
                let { projectId, n, day } = params

                const { subgraphEndpoint } = await this.fetchProject(projectId)
                const topLeaderBoardN = await this.getTopLeaderBoardN(n, day, subgraphEndpoint)

                return { projectId, n, day, topLeaderBoardN }

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
                let { projectId, user, token, balance } = result
                return [
                    { type: 'bytes32', value: projectId },
                    { type: 'address', value: user },
                    { type: 'address', value: token },
                    { type: 'uint256', value: balance },
                ]

            case 'lotteryWinner':
                let { roundId, winners } = result
                return [
                    { type: 'bytes32', value: roundId },
                    { type: 'address[]', value: winners },
                ]

            case 'topLeaderBoardN': {
                let { projectId, n, day, topLeaderBoardN } = result
                return [
                    { type: 'bytes32', value: projectId },
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