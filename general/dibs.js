const { axios, ethCall, BN, recoverTypedMessage } = MuonAppUtils

const subgraphUrl = 'https://api.thegraph.com/subgraphs/name/spsina/dibs'
const DibsRandomSeedGenerator = "0x57ec1c88B493C168048D42d5E96b28C1EAd6eEd9"
const DRSG_ABI = [{ "inputs": [{ "internalType": "uint32", "name": "roundId_", "type": "uint32" }], "name": "getSeed", "outputs": [{ "internalType": "bool", "name": "fulfilled", "type": "bool" }, { "internalType": "uint256", "name": "seed", "type": "uint256" }], "stateMutability": "view", "type": "function" }]
const Dibs = "0x04874d4087E3f611aC555d4Bc1F5BED7bd8B45a0"
const DIBS_ABI = [{ "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "addressToCode", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" }]

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
        const { fulfilled, seed } = await ethCall(DibsRandomSeedGenerator, 'getSeed', [roundId], DRSG_ABI, 56)
        if (!fulfilled || new BN(seed).eq(new BN(0))) throw { message: `No seed` }
        return new BN(seed)
    },

    getRoundWallets: async function (roundId) {
        const query = `{
            userLotteries (
                where: {round: "${roundId}"}
                orderBy: user
            ) {
                id
                user,
                round,
                tickets
            }
        }`

        const data = await this.postQuery(query)
        if (data.userLotteries.length == 0) throw { message: `No Wallet` }

        let wallets = [];
        data.userLotteries.forEach((el) => wallets.push(...Array(el.tickets).fill(el.user)))
        return wallets
    },

    whoIsWinner: async function (seed, wallets) {
        const winnerTicket = seed.mod(new BN(wallets.length))
        return wallets[winnerTicket]
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
                ]

            case 'winner':
                let { roundId, winner } = result
                return [
                    { type: 'uint32', value: roundId },
                    { type: 'address', value: winner },
                ]

            default:
                break
        }
    }
}