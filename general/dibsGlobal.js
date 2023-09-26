const { axios, ethCall, BN, recoverTypedSignature, soliditySha3, toBaseUnit } = MuonAppUtils

const DIBS_ABI = [{ "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "addressToCode", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "dibsLottery", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }]
const DIBS_LOTTERY_ABI = [{ "inputs": [], "name": "winnersPerRound", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }]

const DibsRepository = "0x1370Ff0e5CC846a95f34FE50aD90daad17022797"
const DIBS_REPO_ABI = [{ "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "projects", "outputs": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "address", "name": "dibs", "type": "address" }, { "internalType": "string", "name": "subgraphEndpoint", "type": "string" }, { "internalType": "uint32", "name": "firstRoundStartTime", "type": "uint32" }, { "internalType": "uint32", "name": "roundDuration", "type": "uint32" }, { "internalType": "bool", "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "roundId", "type": "bytes32" }], "name": "getSeed", "outputs": [{ "internalType": "bool", "name": "fulfilled", "type": "bool" }, { "internalType": "uint256", "name": "seed", "type": "uint256" }], "stateMutability": "view", "type": "function" }]

const scaleUp = (value) => new BN(toBaseUnit(String(value), 18))
const VALID_TOLERANCE = scaleUp('0.01')
const SCALE = scaleUp('1')

module.exports = {
    APP_NAME: 'dibsGlobal',

    isToleranceOk: function (amount, expectedAmount, validTolerance) {
        let diff = new BN(amount).sub(new BN(expectedAmount)).abs()
        const diffPercentage = new BN(diff).mul(SCALE).div(new BN(expectedAmount))
        return {
            isOk: !diffPercentage.gt(new BN(validTolerance)),
            diffPercentage: diffPercentage.mul(new BN(100)).div(SCALE)
        }
    },

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

    createTicketsQuery: function (dibs, round, lastUser) {
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

    getRoundTickets: async function (dibs, round, subgraphEndpoint) {
        let lastUser = '0x0000000000000000000000000000000000000000'
        let tickets = []
        let walletsCount = 0

        do {
            const query = this.createTicketsQuery(dibs, round, lastUser)
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

        let signer = recoverTypedSignature({data: typedData, signature: sign, version: "V4"});

        return signer.toLowerCase() === forAddress.toLowerCase()
    },

    isValidUser: async function (dibs, user, chainId) {
        const code = await ethCall(dibs, 'addressToCode', [user], DIBS_ABI, chainId)
        if (code == '0x0000000000000000000000000000000000000000000000000000000000000000') return false
        return true
    },

    getTopLeaderBoardN: async function (dibs, pair, n, day, subgraphEndPoint) {
        const query = `{
            topLeaderBoardN: dailyGeneratedVolumes(first: ${n}, where: {pair: "${pair.toLowerCase()}", day: ${day}, user_not: "${dibs}", amountAsReferrer_gt: "0"}, orderBy: amountAsReferrer, orderDirection: desc) {
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
        const { dibs, chainId, subgraphEndpoint } = await ethCall(DibsRepository, 'projects', [projectId], DIBS_REPO_ABI, 137)
        return { dibs, chainId, subgraphEndpoint }
    },

    fetchSeed: async function (projectId, round) {
        const roundId = soliditySha3([
            { type: 'bytes32', value: projectId },
            { type: 'uint32', value: round },
        ])
        const seed = await this.getSeed(roundId)

        return { seed, roundId }
    },

    fetchWinnersPerRound: async function (dibs, chainId) {
        const dibsLottery = await ethCall(dibs, 'dibsLottery', [], DIBS_ABI, chainId)
        const winnersPerRound = await ethCall(dibsLottery, 'winnersPerRound', [], DIBS_LOTTERY_ABI, chainId)

        return winnersPerRound
    },

    getPlatformBalance: async function (token, subgraphEndPoint) {
        const query = `{
            platformBalance: accumulativeTokenBalances(where: {id: "${token.toLowerCase()}-PLATFORM"}) {
              token
              amount
            }
          }`

        const data = await this.postQuery(query, subgraphEndPoint)

        const platformBalance = data.platformBalance[0]
        if (platformBalance == undefined) throw { message: `Invalid token address` }

        return platformBalance.amount
    },

    getDailyVolume: async function (user, pair, day, subgraphEndpoint) {
        const totalQuery = `{
            totalVolume: dailyGeneratedVolumes(where:{day: ${day}, user: "0x0000000000000000000000000000000000000000", pair: "${pair.toLowerCase()}", amountAsReferrer_gt: "0"}) {
              id
              user
              amountAsUser
              day
            } 
        }`

        const userQuery = `{
            userVolume: dailyGeneratedVolumes(where:{day: ${day}, user: "${user.toLowerCase()}", pair: "${pair.toLowerCase()}", amountAsReferrer_gt: "0"}) {
              id
              user
              amountAsUser
              day
            } 
        }`

        const totalData = (await this.postQuery(totalQuery, subgraphEndpoint)).totalVolume
        const userData = (await this.postQuery(userQuery, subgraphEndpoint)).userVolume

        if (userData.length == 0) throw { message: `NO_RECORD_FOR_USER` }
        if (totalData.length == 0) throw { message: `NO_RECORD_FOR_PLATFORM` }

        const totalVolume = totalData[0].amountAsUser
        const userVolume = userData[0].amountAsUser

        return {
            userVolume,
            totalVolume,
        }
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
                const { tickets, walletsCount } = await this.getRoundTickets(dibs, round, subgraphEndpoint)
                const { seed, roundId } = await this.fetchSeed(projectId, round)
                const winnersPerRound = await this.fetchWinnersPerRound(dibs, chainId)
                const winners = this.determineWinners(winnersPerRound, tickets, walletsCount, seed)

                return { roundId, winners }
            }

            case 'topLeaderBoardN': {
                let { projectId, pair, n, day } = params

                if (parseInt(day) < 0) throw { message: 'NEGATIVE_DAY' }

                const { dibs, subgraphEndpoint } = await this.fetchProject(projectId)
                const topLeaderBoardN = await this.getTopLeaderBoardN(dibs, pair, n, day, subgraphEndpoint)

                return { projectId, pair, n, day, topLeaderBoardN }
            }

            case 'platformClaim': {
                let { projectId, token } = params
                const { subgraphEndpoint } = await this.fetchProject(projectId)
                const balance = await this.getPlatformBalance(token, subgraphEndpoint)
                return { projectId, token, balance }
            }

            case 'userVolume': {
                let {
                    projectId,
                    user,
                    pair,
                    day
                } = params

                if (parseInt(day) < 0) throw { message: 'NEGATIVE_DAY' }

                const { subgraphEndpoint } = await this.fetchProject(projectId)
                const { userVolume, totalVolume } = await this.getDailyVolume(user, pair, day, subgraphEndpoint)

                return {
                    projectId,
                    user,
                    pair,
                    day,
                    userVolume,
                    totalVolume,
                }
            }

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
                let { projectId, pair, n, day, topLeaderBoardN } = result
                return [
                    { type: 'bytes32', value: projectId },
                    { type: 'address', value: pair },
                    { type: 'uint256', value: n },
                    { type: 'uint256', value: day },
                    { type: 'address[]', value: topLeaderBoardN },
                    { type: 'uint256', value: request.data.timestamp },
                ]

            }

            case 'platformClaim': {
                let { projectId, token, balance } = result

                if (!this.isToleranceOk(balance, request.data.result.balance, VALID_TOLERANCE).isOk)
                    throw { message: `Tolerance Error - platform balance` }

                return [
                    { type: 'bytes32', value: projectId },
                    { type: 'string', value: "PLATFORM" },
                    { type: 'address', value: token },
                    { type: 'uint256', value: request.data.result.balance },
                    { type: 'uint256', value: request.data.timestamp },
                ]
            }

            case 'userVolume': {
                let {
                    projectId,
                    user,
                    pair,
                    day,
                    userVolume,
                    totalVolume,
                } = result

                if (!this.isToleranceOk(userVolume, request.data.result.userVolume, VALID_TOLERANCE).isOk)
                    throw { message: `Tolerance Error - user volume` }
                if (!this.isToleranceOk(totalVolume, request.data.result.totalVolume, VALID_TOLERANCE).isOk)
                    throw { message: `Tolerance Error - total volume` }

                return [
                    { type: 'bytes32', value: projectId },
                    { type: 'address', value: user },
                    { type: 'address', value: pair },
                    { type: 'uint256', value: day },
                    { type: 'uint256', value: request.data.result.userVolume },
                    { type: 'uint256', value: request.data.result.totalVolume },
                    { type: 'uint256', value: request.data.timestamp },
                ]
            }

            default:
                break
        }
    }
}