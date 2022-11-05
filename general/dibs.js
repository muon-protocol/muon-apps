const { axios, BN, toBaseUnit } = MuonAppUtils

module.exports = {
    APP_NAME: 'dibs',

    getUserBalance: async function (user, token) {
        const subgraphUrl = 'https://api.thegraph.com/subgraphs/name/spsina/dibs'
        const query = `{
            userBalance: accumulativeTokenBalances(where: {user: "${user}", token: "${token}"}) {
              id
              user
              token
              amount
            }
          }`

        const {
            data: { data }
        } = await axios.post(subgraphUrl, {
            query: query
        })

        return data.userBalance[0].amount

    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'claim':
                let { user, token } = request
                const balance = await this.getUserBalance(user, token)
                return {
                    user, token, balance
                }

            case 'randInt':
                return { randInt: new BN(BigInt(Math.floor(Math.random() * 2 ** 256))).toString() }

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

            case 'randInt':
                return [
                    { type: 'uint256', value: request.data.result.randInt }
                ]

            default:
                break
        }
    }
}