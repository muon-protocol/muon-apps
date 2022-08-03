const { axios, soliditySha3, BN, Web3 } = MuonAppUtils

const CHAINS = {
    mainnet: 1,
    fantom: 250,
}

module.exports = {
    APP_NAME: 'price_feed',
    APP_ID: 26,
    REMOTE_CALL_TIMEOUT: 30000,


    isPriceToleranceOk: function (price, expectedPrice) {
        let priceDiff = new BN(price).sub(new BN(expectedPrice)).abs()

        if (
            new BN(priceDiff)
                .div(new BN(expectedPrice))
                .gt(toBaseUnit(PRICE_TOLERANCE, '18'))
        ) {
            return false
        }
        return true
    },

    getSeed: async function (chain, pairAddress, denomerator) {

    },

    getSyncEvents: async function (chain, seedBlockNumber, pairAddress, denomerator) {

    },

    createPrices: function (syncEvents) {

    },

    calculatePrice: function (prices) {

    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request

        switch (method) {
            case 'signature':

                let { chain, pairAddress, denomerator } = params
                if (!chain) throw { message: 'Invalid chain' }
                if (![0, 1].includes(denomerator)) throw { message: 'Invalid denomerator' }

                const seed = await this.getSeed(chain, pairAddress, denomerator)
                const syncEvents = await this.getSyncEvents(chain, seed.blockNumber, pairAddress, denomerator)
                const prices = this.createPrices(syncEvents)
                const price = this.calculatePrice(prices)

                return {
                    chain: chain,
                    price: price,
                    denomerator: denomerator
                }

            default:
                throw { message: `Unknown method ${params}` }
        }
    },

    hashRequestResult: function (request, result) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'signature': {

                let { chain, price, denomerator } = result

                return soliditySha3([
                    { type: 'uint32', value: this.APP_ID },
                    { type: 'uint256', value: price },
                    { type: 'uint256', value: denomerator },
                    { type: 'uint256', value: String(CHAINS[chain]) },
                    { type: 'uint256', value: request.data.timestamp }
                ])

            }
            default:
                return null
        }
    }
}
