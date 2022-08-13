const { toBaseUnit, soliditySha3, BN, Web3 } = MuonAppUtils

const HttpProvider = Web3.providers.HttpProvider

const CHAINS = {
    mainnet: 1,
    fantom: 250,
}

const networksWeb3 = {
    1: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_ETH)),
    250: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_FTM)),
}

const networksBlockIn30Min = {
    1: 146,
    250: 1650
}

const PRICE_TOLERANCE = '0.0005'
const Q112 = new BN(2).pow(new BN(112))

const UNISWAPV2_PAIR_ABI = [{ "constant": true, "inputs": [], "name": "getReserves", "outputs": [{ "internalType": "uint112", "name": "_reserve0", "type": "uint112" }, { "internalType": "uint112", "name": "_reserve1", "type": "uint112" }, { "internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32" }], "payable": false, "stateMutability": "view", "type": "function" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint112", "name": "reserve0", "type": "uint112" }, { "indexed": false, "internalType": "uint112", "name": "reserve1", "type": "uint112" }], "name": "Sync", "type": "event" }]

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

    calculateInstantPrice: function (reserve0, reserve1) {
        // multiply reserveA into Q112 for precision in division 
        // reserveA * (2 ** 112) / reserverB
        const price0 = (new BN(reserve1)).mul(Q112).div(new BN(reserve0))
        const price1 = (new BN(reserve0)).mul(Q112).div(new BN(reserve1))
        return { price0, price1 }
    },

    getSeed: async function (chainId, pairAddress) {
        const w3 = networksWeb3[chainId]
        const seedBlockNumber = (await w3.eth.getBlock("latest")).number - networksBlockIn30Min[chainId]
        const pair = new w3.eth.Contract(UNISWAPV2_PAIR_ABI, pairAddress)
        const { _reserve0, _reserve1 } = await pair.methods.getReserves().call(seedBlockNumber)
        const { price0, price1 } = this.calculateInstantPrice(_reserve0, _reserve1)
        return { price0: price0, price1: price1, blockNumber: seedBlockNumber }

    },

    getSyncEvents: async function (chainId, seedBlockNumber, pairAddress) {
        const w3 = networksWeb3[chainId]
        const pair = new w3.eth.Contract(UNISWAPV2_PAIR_ABI, pairAddress)
        const options = {
            fromBlock: seedBlockNumber + 1,
            toBlock: seedBlockNumber + networksBlockIn30Min[chainId]
        }
        const events = await pair.getPastEvents("Sync", options)
        return events
    },

    createPrices: function (chainId, seed, syncEvents) {
        let syncEventsMap = {}
        // {key: event.blockNumber => value: event}
        syncEvents.forEach((event) => syncEventsMap[event.blockNumber] = event)

        let prices = [seed]
        let price = { ...seed }
        // fill prices and consider a price for each block between seed and current block
        for (let blockNumber = seed.blockNumber + 1; blockNumber <= seed.blockNumber + networksBlockIn30Min[chainId]; blockNumber++) {
            // use block event price if there is an event for the block
            // otherwise use last event price
            if (syncEventsMap[blockNumber]) {
                const { reserve0, reserve1 } = syncEventsMap[blockNumber].returnValues
                price = this.calculateInstantPrice(reserve0, reserve1)
            }
            price.blockNumber = blockNumber
            prices.push({ ...price })
        }
        return prices
    },

    std: function (arr) {
        let mean = arr.reduce((result, el) => result.add(el), new BN(0)).div(new BN(arr.length))

        arr = arr.map((k) => k.sub(mean).pow(new BN(2)))

        let sum = arr.reduce((result, el) => result.add(el), new BN(0))

        let variance = sum.div(new BN(arr.length))

        return BigInt(Math.sqrt(variance))
    },

    removeOutlierZScore: function (prices, prices0) {
        const threshold = 2
        const mean = this.calculateAveragePrice(prices)
        // calculate std(standard deviation)
        const std0 = this.std(prices0)
        if (std0 == 0) return prices

        let result = []
        // Z score = (price - mean) / std
        // price is not reliable if Z score < threshold
        prices.forEach((price) => price.price0.sub(mean.price0).div(new BN(std0)).abs() < threshold ? result.push(price) : {})
        return result

    },

    removeOutlier: function (prices) {
        const logPrices = []
        prices.forEach((price) => logPrices.push({ price0: new BN(BigInt(Math.round(Math.log(price.price0)))), price1: new BN(BigInt(Math.round(Math.log(price.price1)))), blockNumber: price.blockNumber }))
        const logPrices0 = []
        prices.forEach((price) => logPrices0.push(price.price0))
        let logOutlierRemoved = this.removeOutlierZScore(logPrices, logPrices0)

        let logOutlierRemovedPrices0 = []
        logOutlierRemoved.forEach((price) => logOutlierRemovedPrices0.push(price.price0))
        logOutlierRemoved = this.removeOutlierZScore(logOutlierRemoved, logOutlierRemovedPrices0)

        const outlierRemoved = []
        prices.forEach((price, index) => logOutlierRemoved.includes(logPrices[index]) ? outlierRemoved.push(price) : {})

        return outlierRemoved
    },

    calculateAveragePrice: function (prices) {
        const sumPrice = prices.reduce((result, event) => { return { price0: result.price0.add(new BN(event.price0)), price1: result.price1.add(new BN(event.price1)) } }, { price0: new BN(0), price1: new BN(0) })
        const averagePrice = { price0: sumPrice.price0.div(new BN(prices.length)), price1: sumPrice.price1.div(new BN(prices.length)) }
        return averagePrice
    },

    checkLastDayPrice: function () {

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

                // get price of 30 mins ago
                const seed = await this.getSeed(chainId, pairAddress)
                // get sync events that are less than 30 mins old 
                const syncEvents = await this.getSyncEvents(chainId, seed.blockNumber, pairAddress)
                // create an array contains a price for each block mined 30 mins ago
                const prices = this.createPrices(chainId, seed, syncEvents)
                // remove outlier prices
                const reliablePrices = this.removeOutlier(prices)
                // calculate the average price
                const price = this.calculateAveragePrice(reliablePrices)
                // check for high price change in 1D
                this.checkLastDayPrice()

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

                let priceTolerancesStatus = []
                // node1 result
                let [expectedPrice0, expectedPrice1] = [request.data.result.price0, request.data.result.price1];
                // check price difference between current node and node1
                [
                    { price: price0, expectedPrice: expectedPrice0 },
                    { price: price1, expectedPrice: expectedPrice1 }
                ].forEach(
                    (price) => priceTolerancesStatus.push(this.isPriceToleranceOk(price.price, price.expectedPrice))
                )
                // throw error in case of high price difference between current node and node1
                if (
                    priceTolerancesStatus.includes(false)
                ) {
                    throw { message: 'Price threshold exceeded' }
                }

                return soliditySha3([
                    { type: 'uint32', value: this.APP_ID },
                    { type: 'address', value: pairAddress },
                    { type: 'uint256', value: expectedPrice0 },
                    { type: 'uint256', value: expectedPrice1 },
                    { type: 'uint256', value: String(CHAINS[chain]) },
                    { type: 'uint256', value: request.data.timestamp }
                ])

            }
            default:
                return null
        }
    }
}
