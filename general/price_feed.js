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

    createPrices: function (seed, syncEvents) {
        let prices = []
        let blockNumber = seed.blockNumber
        let lastPrice0 = seed.price0
        let lastPrice1 = seed.price1
        for (const event of syncEvents) {
            if (event.blockNumber != blockNumber)
                [...Array(event.blockNumber - blockNumber).fill({ price0: lastPrice0, price1: lastPrice1 })].forEach((price) => prices.push({ price0: price.price0, price1: price.price1, blockNumber: blockNumber++ }))
            else
                blockNumber++

            prices.push(event)
            lastPrice0 = event.price0
            lastPrice1 = event.price1
        }
        return prices
    },

    calculatePrice: function (prices) {
        const sumPrice = prices.reduce((result, event) => { return { price0: result.price0.add(new BN(event.price0)), price1: result.price1.add(new BN(event.price1)) } }, { price0: new BN(0), price1: new BN(0) })
        const averagePrice = { price0: sumPrice.price0.div(new BN(prices.length)), price1: sumPrice.price1.div(new BN(prices.length)) }
        return averagePrice
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request

        switch (method) {
            case 'signature':

                let { chain, pairAddress } = params
                if (!chain) throw { message: 'Invalid chain' }

                const chainId = CHAINS[chain]

                const seed = await this.getSeed(chainId, pairAddress)
                const syncEvents = await this.getSyncEvents(chainId, seed.blockNumber, pairAddress)
                const prices = this.createPrices(seed, syncEvents)
                const price = this.calculatePrice(prices)

                return {
                    chain: chain,
                    pairAddress: pairAddress,
                    price0: price.price0.toString(),
                    price1: price.price1.toString()
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

                let { chain, pairAddress, price0, price1 } = result

                return soliditySha3([
                    { type: 'uint32', value: this.APP_ID },
                    { type: 'address', value: pairAddress },
                    { type: 'uint256', value: price0 },
                    { type: 'uint256', value: price1 },
                    { type: 'uint256', value: String(CHAINS[chain]) },
                    { type: 'uint256', value: request.data.timestamp }
                ])

            }
            default:
                return null
        }
    }
}
