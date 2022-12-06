const { axios, BN, toBaseUnit } = MuonAppUtils

const subgraphUrl = 'https://api.thegraph.com/subgraphs/name/spsina/dibs'

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

        return data.userBalance[0].amount
    },

    getRoundWallets: async function (roundId) {
        const query = `{
            userLotteries (
                where: {roundId: ${roundId}}
                orderBy: user
            ) {
                id
                user,
                round,
                tickets
            }
        }`

        let wallets = []
        await this.postQuery(query).userLotteries.forEach((el) => wallets.push(...Array(el.tickets).fill(el.user)))
        if (wallets.length == 0) throw { message: `No Wallet` }
        return wallets

    },

    whoIsWinner: async function (seed, wallets) {
        const winnerTicket = seed % wallets.length
        return wallets[winnerTicket]
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'claim':
                let { user, token } = params
                const balance = await this.getUserBalance(user, token)
                return {
                    user, token, balance
                }

            case 'winner':
                let { roundId } = params
                const seed = await this.getSeed(roundId)
                const wallets = await this.getRoundWallets(roundId)
                const winner = await this.whoIsWinner(seed, wallets)

                return { roundId, winner }

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
                    { type: 'uint256', value: request.data.timestamp }
                ]

            case 'winner':
                let { roundId, winner } = result
                return [
                    { type: 'uint256', value: roundId },
                    { type: 'address', value: winner },
                ]

            default:
                break
        }
    }
}