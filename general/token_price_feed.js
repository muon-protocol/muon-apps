const { ethCall, ethGetBlock, ethGetBlockNumber, BN } = MuonAppUtils
const PriceFeed = require('./price_feed')

const {
    CHAINS,
    Q112,
} = PriceFeed

const blocksToAvoidReorg = {
    [CHAINS.mainnet]: 3,
    [CHAINS.fantom]: 26,
    [CHAINS.polygon]: 15,
}

const CONFIG_ABI = [{ "inputs": [], "name": "getRoutes", "outputs": [{ "internalType": "uint256", "name": "validPriceGap_", "type": "uint256" }, { "components": [{ "internalType": "uint256", "name": "index", "type": "uint256" }, { "internalType": "string", "name": "dex", "type": "string" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "bool[]", "name": "reversed", "type": "bool[]" }, { "internalType": "uint256[]", "name": "fusePriceTolerance", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToSeed", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToFuse", "type": "uint256[]" }, { "internalType": "uint256", "name": "weight", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct IConfig.Config", "name": "config", "type": "tuple" }], "internalType": "struct IConfig.Route[]", "name": "routes_", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }]

module.exports = {
    ...PriceFeed,

    APP_NAME: 'token_price_feed',

    getRoute: async function (config) {
        let routes = await ethCall(config, 'getRoutes', [], CONFIG_ABI, CHAINS.fantom)
        const chainIds = new Set()
        routes = {
            validPriceGap: routes.validPriceGap_,
            routes: routes.routes_.map((route) => {
                chainIds.add(route.config.chainId)
                return {
                    chainId: route.config.chainId,
                    dex: route.dex,
                    path: route.path.map((address, i) => {
                        return {
                            address: address,
                            reversed: route.config.reversed[i],
                            fusePriceTolerance: route.config.fusePriceTolerance[i],
                            minutesToSeed: route.config.minutesToSeed[i],
                            minutesToFuse: route.config.minutesToFuse[i]
                        }
                    }),
                    weight: route.config.weight
                }
            })
        }

        return { routes, chainIds }
    },

    getTokenPairPrice: async function (chainId, pair, toBlock) {
        let pairPrice = await this.calculatePairPrice(chainId, pair, toBlock)
        return new BN(pair.reversed ? new BN(pairPrice.price1) : new BN(pairPrice.price0))
    },

    calculatePrice: async function (validPriceGap, routes, toBlocks) {
        let tokenPairPrice
        let sumTokenPrice = new BN(0)
        let sumWeights = new BN(0)
        let prices = []

        for (let route of routes) {
            let price = Q112
            for (let pair of route.path) {
                tokenPairPrice = await this.getTokenPairPrice(route.chainId, pair, toBlocks[route.chainId])
                price = price.mul(tokenPairPrice).div(Q112)
            }
            sumTokenPrice = sumTokenPrice.add(price.mul(new BN(route.weight)))
            sumWeights = sumWeights.add(new BN(route.weight))
            prices.push(price)
        }
        if (prices.length > 1) {
            let [minPrice, maxPrice] = [BN.min(...prices), BN.max(...prices)]
            if (!this.isPriceToleranceOk(maxPrice, minPrice, validPriceGap).isOk)
                throw { message: `High price gap between route prices (${minPrice}, ${maxPrice})` }
        }
        return sumTokenPrice.div(sumWeights)
    },

    getReliableBlock: async function (chainId) {
        const latestBlock = await ethGetBlockNumber(chainId)
        const reliableBlock = latestBlock - blocksToAvoidReorg[chainId]
        return reliableBlock
    },

    prepareToBlocks: async function (chainIds) {
        const toBlocks = {}
        for (let chainId of chainIds) {
            // consider a few blocks before the current block as toBlock to avoid reorg
            toBlocks[chainId] = await this.getReliableBlock(chainId)
        }

        return toBlocks
    },

    getEarliestBlockTimestamp: async function (chainIds, toBlocks) {
        const promises = []
        for (const chainId of chainIds) {
            promises.push(ethGetBlock(chainId, toBlocks[chainId]))
        }

        const blocks = await Promise.all(promises)
        const timestamps = []
        blocks.forEach((block) => {
            timestamps.push(block.timestamp)
        })
        return Math.min(...timestamps)
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request

        switch (method) {
            case 'signature':

                let { config, toBlocks } = params

                // get token route for calculating price
                const { routes, chainIds } = await this.getRoute(config)
                if (!routes) throw { message: 'Invalid config' }

                // prepare toBlocks 
                if (!toBlocks) {
                    if (!request.data.result)
                        toBlocks = await this.prepareToBlocks(chainIds)
                    else
                        toBlocks = request.data.result.toBlocks
                }

                // calculate price using the given route
                const price = await this.calculatePrice(routes.validPriceGap, routes.routes, toBlocks)

                // get earliest block timestamp
                const timestamp = await this.getEarliestBlockTimestamp(chainIds, toBlocks)

                return {
                    config: config,
                    routes: routes,
                    price: price.toString(),
                    toBlocks: toBlocks,
                    timestamp: timestamp
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
        let { method } = request
        switch (method) {
            case 'signature': {

                let { config, price, timestamp } = result

                return [
                    { type: 'address', value: config },
                    { type: 'uint256', value: price },
                    { type: 'uint256', value: timestamp }
                ]

            }
            default:
                break
        }
    }
}
