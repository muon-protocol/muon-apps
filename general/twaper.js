const { ethCall, ethGetBlock, BN } = MuonAppUtils
const Pair = require('./pair')

const {
    CHAINS,
    Q112,
} = Pair

const chainNames = {
    [CHAINS.mainnet]: 'ethereum',
    [CHAINS.fantom]: 'fantom',
    [CHAINS.polygon]: 'polygon',
    [CHAINS.bsc]: 'bsc',
    [CHAINS.avax]: 'avalanche',
}

const CONFIG_ABI = [{ "inputs": [], "name": "getRoutes", "outputs": [{ "internalType": "uint256", "name": "validPriceGap_", "type": "uint256" }, { "components": [{ "internalType": "string", "name": "dex", "type": "string" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "string", "name": "abiStyle", "type": "string" }, { "internalType": "bool[]", "name": "reversed", "type": "bool[]" }, { "internalType": "uint256[]", "name": "fusePriceTolerance", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToSeed", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToFuse", "type": "uint256[]" }, { "internalType": "uint256", "name": "weight", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct IConfig.Config", "name": "config", "type": "tuple" }], "internalType": "struct IConfig.Route[]", "name": "routes_", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }]
const LP_CONFIG_ABI = [{ "inputs": [], "name": "getMetaData", "outputs": [{ "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "address", "name": "pair", "type": "address" }, { "components": [{ "components": [{ "internalType": "string", "name": "dex", "type": "string" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "string", "name": "abiStyle", "type": "string" }, { "internalType": "bool[]", "name": "reversed", "type": "bool[]" }, { "internalType": "uint256[]", "name": "fusePriceTolerance", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToSeed", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToFuse", "type": "uint256[]" }, { "internalType": "uint256", "name": "weight", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct IConfig.Config", "name": "config", "type": "tuple" }], "internalType": "struct IConfig.Route[]", "name": "routes_", "type": "tuple[]" }, { "internalType": "uint256", "name": "validPriceGap_", "type": "uint256" }], "internalType": "struct LpConfig.ConfigMetaData", "name": "config0", "type": "tuple" }, { "components": [{ "components": [{ "internalType": "string", "name": "dex", "type": "string" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "string", "name": "abiStyle", "type": "string" }, { "internalType": "bool[]", "name": "reversed", "type": "bool[]" }, { "internalType": "uint256[]", "name": "fusePriceTolerance", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToSeed", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToFuse", "type": "uint256[]" }, { "internalType": "uint256", "name": "weight", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct IConfig.Config", "name": "config", "type": "tuple" }], "internalType": "struct IConfig.Route[]", "name": "routes_", "type": "tuple[]" }, { "internalType": "uint256", "name": "validPriceGap_", "type": "uint256" }], "internalType": "struct LpConfig.ConfigMetaData", "name": "config1", "type": "tuple" }], "internalType": "struct LpConfig.LpMetaData", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }]

module.exports = {
    ...Pair,

    APP_NAME: 'twaper',

    formatRoutes: function (metaData) {
        const chainIds = new Set()
        const routes = {
            validPriceGap: String(metaData.validPriceGap_),
            routes: metaData.routes_.map((route) => {
                chainIds.add(route.config.chainId)
                return {
                    chainId: parseInt(route.config.chainId),
                    abiStyle: route.config.abiStyle,
                    path: route.path.map((address, i) => {
                        return {
                            address: address,
                            reversed: route.config.reversed[i],
                            fusePriceTolerance: String(route.config.fusePriceTolerance[i]),
                            minutesToSeed: parseInt(route.config.minutesToSeed[i]),
                            minutesToFuse: parseInt(route.config.minutesToFuse[i])
                        }
                    }),
                    weight: parseInt(route.config.weight)
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

    getLpTotalSupply: async function (pairAddress, chainId, toBlock) {
        const reservesDecoder = (res) => { return w3.eth.abi.decodeParameters([{ "internalType": "uint112", "name": "_reserve0", "type": "uint112" }, { "internalType": "uint112", "name": "_reserve1", "type": "uint112" }, { "internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32" }], res) }
        const totalSupplyDecoder = (res) => { return w3.eth.abi.decodeParameters([{ "internalType": "uint256", "name": "", "type": "uint256" }], res) }
        const w3 = this.networksWeb3[chainId]
        const pair = new w3.eth.Contract(this.UNISWAPV2_PAIR_ABI, pairAddress)
        pair.address = pairAddress
        const [reserves, totalSupply] = await this.makeBatchRequest(w3, [
            { req: this.makeEthCallRequest(0, pair, 'getReserves', [], toBlock), decoder: reservesDecoder },
            { req: this.makeEthCallRequest(1, pair, 'totalSupply', [], toBlock), decoder: totalSupplyDecoder },
        ])

        const K = new BN(reserves._reserve0).mul(new BN(reserves._reserve1))
        return { K, totalSupply: new BN(totalSupply['0']) }
    },

    getLpMetaData: async function (config) {
        const { chainId, pair, config0, config1 } = await ethCall(config, 'getMetaData', [], LP_CONFIG_ABI, CHAINS.fantom)

        let { routes: routes0, chainIds: chainIds0 } = this.formatRoutes(config0)
        let { routes: routes1, chainIds: chainIds1 } = this.formatRoutes(config1)

        const chainIds = new Set([...chainIds0, ...chainIds1])

        return { chainId, pair, routes0, routes1, chainIds }
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

    _validateToBlock: async function (id, toBlock, timestamp) {
        const promises = [
            ethGetBlock(id, toBlock),
            ethGetBlock(id, toBlock + 1),
        ]
        const [block0, block1] = await Promise.all(promises)

        /* returns true if:

            1. block0 <= timestamp < block
            2. (block0 <= timestamp && block0 == block1) => block0 = timestamp = block1

            case No.2 happens in chains with low blockTime like fantom
        */
        return block0.timestamp <= timestamp && (timestamp < block1.timestamp || block0.timestamp == block1.timestamp)
    },

    validateToBlocks: async function (chainIds, toBlocks, timestamp) {
        const promises = []

        chainIds.forEach((id) => {
            if (toBlocks[id] == undefined) throw { message: `Undefined toBlock for ${chainNames[id]}(${id})` }
            promises.push(this._validateToBlock(id, toBlocks[id], timestamp))
        })

        const result = await Promise.all(promises)

        return !result.includes(false)
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request

        switch (method) {
            case 'price':

                let { config, timestamp, toBlocks } = params

                // get token route for calculating price
                const { routes, chainIds } = await this.getRoutes(config)
                if (!routes) throw { message: 'Invalid config' }

                toBlocks = JSON.parse(toBlocks)

                // check if toBlocks are related to timestamp
                // it also check if there are toBlock for each chain
                const isValid = await this.validateToBlocks(chainIds, toBlocks, timestamp)
                if (!isValid) throw { message: 'Invalid toBlocks' }

                // calculate price using the given route
                const { price, removedPrices } = await this.calculatePrice(routes.validPriceGap, routes.routes, toBlocks)

                return {
                    config,
                    routes,
                    price: price.toString(),
                    removedPrices,
                    toBlocks,
                    timestamp
                }

            case 'lp_price': {
                let { config, timestamp, toBlocks } = params

                let { chainId, pair, routes0, routes1, chainIds } = await this.getLpMetaData(config)

                toBlocks = JSON.parse(toBlocks)

                // check if toBlocks are related to timestamp
                // it also check if there are toBlock for each chain
                const isValid = await this.validateToBlocks(chainIds, toBlocks, timestamp)
                if (!isValid) throw { message: 'Invalid toBlocks' }

                const price = await this.calculateLpPrice(chainId, pair, routes0, routes1, toBlocks)

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
