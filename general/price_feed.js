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
        let prices = []
        let blockNumber = seed.blockNumber + networksBlockIn30Min[chainId]
        // loop through sync events in reverse order to ignore multiple sync events in the same block easily
        // fill the prices array from blockNumber to seedBlockNumber(blocks mined in 30 mins ago)
        for (const event of syncEvents.reverse()) {
            // push the block price after filling the gap between two sync events
            if (event.blockNumber < blockNumber || event.blockNumber == blockNumber) {
                // calculate price in the block of event
                let { price0, price1 } = this.calculateInstantPrice(event.returnValues.reserve0, event.returnValues.reserve1);
                // consider a price for each block between two sync events with block difference more than one 
                // use current event for considered price
                [...Array(blockNumber - event.blockNumber)].forEach(() => prices.push({ price0: price0, price1: price1, blockNumber: blockNumber-- }))
                // push price in the block of event
                prices.push({ price0: price0, price1: price1, blockNumber: event.blockNumber })
                blockNumber--
            }
            // ignore multiple sync events in one block
            else if (event.blockNumber == blockNumber + 1)
                continue
            else
                throw { message: 'Invalid event order' }
        }
        // consider a price for blocks between seed and first sync event
        // use seed price as considered price
        [...Array(blockNumber - seed.blockNumber + 1)].forEach(() => prices.push({ price0: seed.price0, price1: seed.price1, blockNumber: blockNumber-- }))
        return prices
    },

    calculateAveragePrice: function (prices) {
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

                // get price of 30 mins ago
                const seed = await this.getSeed(chainId, pairAddress)
                // get sync events that are less than 30 mins old 
                const syncEvents = await this.getSyncEvents(chainId, seed.blockNumber, pairAddress)
                // create an array contains a price for each block mined 30 mins ago
                const prices = this.createPrices(chainId, seed, syncEvents)
                // calculate the average price
                const price = this.calculateAveragePrice(prices)

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
