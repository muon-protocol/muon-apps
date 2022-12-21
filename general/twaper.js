const { ethCall, ethGetBlock, ethGetBlockNumber, BN } = MuonAppUtils
const Pair = require('./pair')

const {
    CHAINS,
    Q112,
} = Pair

const blocksToAvoidReorg = {
    [CHAINS.mainnet]: 3,
    [CHAINS.fantom]: 26,
    [CHAINS.polygon]: 15,
}

const CONFIG_ABI = [{ "inputs": [], "name": "getRoutes", "outputs": [{ "internalType": "uint256", "name": "validPriceGap_", "type": "uint256" }, { "components": [{ "internalType": "uint256", "name": "index", "type": "uint256" }, { "internalType": "string", "name": "dex", "type": "string" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "string", "name": "abiStyle", "type": "string" }, { "internalType": "bool[]", "name": "reversed", "type": "bool[]" }, { "internalType": "uint256[]", "name": "fusePriceTolerance", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToSeed", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToFuse", "type": "uint256[]" }, { "internalType": "uint256", "name": "weight", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct IConfig.Config", "name": "config", "type": "tuple" }], "internalType": "struct IConfig.Route[]", "name": "routes_", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }]
const LP_CONFIG_ABI = [{ "inputs": [], "name": "getMetaData", "outputs": [{ "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "address", "name": "pair", "type": "address" }, { "components": [{ "components": [{ "internalType": "uint256", "name": "index", "type": "uint256" }, { "internalType": "string", "name": "dex", "type": "string" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "string", "name": "abiStyle", "type": "string" }, { "internalType": "bool[]", "name": "reversed", "type": "bool[]" }, { "internalType": "uint256[]", "name": "fusePriceTolerance", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToSeed", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToFuse", "type": "uint256[]" }, { "internalType": "uint256", "name": "weight", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct IConfig.Config", "name": "config", "type": "tuple" }], "internalType": "struct IConfig.Route[]", "name": "routes_", "type": "tuple[]" }, { "internalType": "uint256", "name": "validPriceGap_", "type": "uint256" }], "internalType": "struct LpConfig.ConfigMetaData", "name": "config0", "type": "tuple" }, { "components": [{ "components": [{ "internalType": "uint256", "name": "index", "type": "uint256" }, { "internalType": "string", "name": "dex", "type": "string" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "string", "name": "abiStyle", "type": "string" }, { "internalType": "bool[]", "name": "reversed", "type": "bool[]" }, { "internalType": "uint256[]", "name": "fusePriceTolerance", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToSeed", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToFuse", "type": "uint256[]" }, { "internalType": "uint256", "name": "weight", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct IConfig.Config", "name": "config", "type": "tuple" }], "internalType": "struct IConfig.Route[]", "name": "routes_", "type": "tuple[]" }, { "internalType": "uint256", "name": "validPriceGap_", "type": "uint256" }], "internalType": "struct LpConfig.ConfigMetaData", "name": "config1", "type": "tuple" }], "internalType": "struct LpConfig.LpMetaData", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }]

module.exports = {
    ...Pair,

    APP_NAME: 'twaper',

    formatRoutes: function (metaData) {
        const chainIds = new Set()
        const routes = {
            validPriceGap: metaData.validPriceGap_,
            routes: metaData.routes_.map((route) => {
                chainIds.add(route.config.chainId)
                return {
                    chainId: route.config.chainId,
                    abiStyle: route.config.abiStyle,
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

    getRoutes: async function (config) {
        let configMetaData = await ethCall(config, 'getRoutes', [], CONFIG_ABI, CHAINS.fantom)
        return this.formatRoutes(configMetaData)
    },

    getTokenPairPrice: async function (chainId, abiStyle, pair, toBlock) {
        const pairPrice = await this.calculatePairPrice(chainId, abiStyle, pair, toBlock)
        return { tokenPairPrice: new BN(pair.reversed ? new BN(pairPrice.price1) : new BN(pairPrice.price0)), removed: pairPrice.removed }
    },

    calculatePrice: async function (validPriceGap, routes, toBlocks) {
        if (routes.length == 0)
            return { price: Q112, removedPrices: [] }

        let sumTokenPrice = new BN(0)
        let sumWeights = new BN(0)
        let prices = []
        const removedPrices = []

        const promises = []
        for (let [i, route] of routes.entries()) {
            for (let pair of route.path) {
                promises.push(this.getTokenPairPrice(route.chainId, route.abiStyle, pair, toBlocks[route.chainId]))
            }
        }

        let result = await Promise.all(promises)

        for (let route of routes) {
            let price = Q112
            const routeRemovedPrices = []
            for (let pair of route.path) {
                price = price.mul(result[0].tokenPairPrice).div(Q112)
                routeRemovedPrices.push(result[0].removed)
                result = result.slice(1)
            }

            sumTokenPrice = sumTokenPrice.add(price.mul(new BN(route.weight)))
            sumWeights = sumWeights.add(new BN(route.weight))
            prices.push(price)
            removedPrices.push(routeRemovedPrices)
        }

        if (prices.length > 1) {
            let [minPrice, maxPrice] = [BN.min(...prices), BN.max(...prices)]
            if (!this.isPriceToleranceOk(maxPrice, minPrice, validPriceGap).isOk)
                throw { message: `High price gap between route prices (${minPrice}, ${maxPrice})` }
        }
        return { price: sumTokenPrice.div(sumWeights), removedPrices }
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

    getLpTotalSupply: async function (pairAddress, chainId, toBlock) {
        const w3 = this.networksWeb3[chainId]
        const pair = new w3.eth.Contract(this.UNISWAPV2_PAIR_ABI, pairAddress)
        const [reserves, totalSupply] = await this.makeBatchRequest(w3, [
            { req: pair.methods.getReserves().call, block: toBlock },
            { req: pair.methods.totalSupply().call, block: toBlock },
        ])

        const K = new BN(reserves._reserve0).mul(new BN(reserves._reserve1))
        return { K, totalSupply: new BN(totalSupply) }
    },

    getLpMetaData: async function (config) {
        const { chainId, pair, config0, config1 } = await ethCall(config, 'getMetaData', [], LP_CONFIG_ABI, CHAINS.fantom)
        return { chainId, pair, config0, config1 }
    },

    calculateLpPrice: async function (chainId, pair, routes0, routes1, toBlocks) {
        // prepare promises for calculating each config price
        const promises = [
            this.calculatePrice(routes0.validPriceGap, routes0.routes, toBlocks),
            this.calculatePrice(routes1.validPriceGap, routes1.routes, toBlocks)
        ]

        let [price0, price1] = await Promise.all(promises)
        const { K, totalSupply } = await this.getLpTotalSupply(pair, chainId, toBlocks[chainId])

        // calculate lp token price based on price0 & price1 & K & totalSupply
        const numerator = new BN(2).mul(new BN(BigInt(Math.sqrt(price0.price.mul(price1.price).mul(K)))))
        const price = numerator.div(totalSupply)
        return price
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request

        switch (method) {
            case 'price':

                let { config, toBlocks } = params

                // get token route for calculating price
                const { routes, chainIds } = await this.getRoutes(config)
                if (!routes) throw { message: 'Invalid config' }

                // prepare toBlocks 
                if (!toBlocks) {
                    if (!request.data.result)
                        toBlocks = await this.prepareToBlocks(chainIds)
                    else
                        toBlocks = request.data.result.toBlocks
                }
                else toBlocks = JSON.parse(toBlocks)

                // calculate price using the given route
                const { price, removedPrices } = await this.calculatePrice(routes.validPriceGap, routes.routes, toBlocks)

                // get earliest block timestamp
                const timestamp = await this.getEarliestBlockTimestamp(chainIds, toBlocks)

                return {
                    config,
                    routes,
                    price: price.toString(),
                    removedPrices,
                    toBlocks,
                    timestamp
                }

            case 'lp_price': {
                let { config, toBlocks } = params

                let { chainId, pair, config0, config1 } = await this.getLpMetaData(config)

                let { routes: routes0, chainIds: chainIds0 } = this.formatRoutes(config0)
                let { routes: routes1, chainIds: chainIds1 } = this.formatRoutes(config1)

                const chainIds = new Set([...chainIds0, ...chainIds1])

                // prepare toBlocks 
                if (!toBlocks) {
                    if (!request.data.result)
                        toBlocks = await this.prepareToBlocks(chainIds)
                    else
                        toBlocks = request.data.result.toBlocks
                }
                else toBlocks = JSON.parse(toBlocks)

                const price = await this.calculateLpPrice(chainId, pair, routes0, routes1, toBlocks)

                // get earliest block timestamp
                const timestamp = await this.getEarliestBlockTimestamp(chainIds, toBlocks)

                return {
                    config,
                    price: price.toString(),
                    toBlocks,
                    timestamp
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
        let { method } = request
        switch (method) {
            case 'price':
            case 'lp_price': {

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
