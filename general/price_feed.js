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
        let prices = [seed]
        blockNumber = seed.blockNumber + 1
        lastPrice = seed.price
        for (const event of syncEvents) {
            if (event.blockNumber != blockNumber)
                [...Array(event.blockNumber - blockNumber).fill(lastPrice)].forEach((price) => prices.push({ price: price, blockNumber: blockNumber++ }))
            else
                blockNumber++

            prices.push(event)
            lastPrice = seed.price
        }
        return prices
    },

    calculatePrice: function (prices) {
        const average = prices.reduce((result, event) => result.add(new BN(event.price)), new BN(0)).div(prices.length)
        return average
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
                const prices = this.createPrices(seed, syncEvents)
                const price = this.calculatePrice(prices)

                return {
                    chain: chain,
                    pairAddress: pairAddress,
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

                let { chain, pairAddress, price, denomerator } = result

                return soliditySha3([
                    { type: 'uint32', value: this.APP_ID },
                    { type: 'address', value: pairAddress },
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
