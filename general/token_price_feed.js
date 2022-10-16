const { soliditySha3, BN } = MuonAppUtils
const PriceFeed = require('./price_feed')

const {
    CHAINS,
    networksWeb3,
    Q112,
    ETH
} = PriceFeed

const confirmationBlocks = {
    [CHAINS.mainnet]: 12,
    [CHAINS.fantom]: 1,
}

const CONFIG_ABI = [{ "inputs": [], "name": "getRoutes", "outputs": [{ "internalType": "uint256", "name": "validPriceGap_", "type": "uint256" }, { "components": [{ "internalType": "uint256", "name": "index", "type": "uint256" }, { "internalType": "string", "name": "dex", "type": "string" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "components": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "bool[]", "name": "reversed", "type": "bool[]" }, { "internalType": "uint256[]", "name": "fusePriceTolerance", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToSeed", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "minutesToFuse", "type": "uint256[]" }, { "internalType": "uint256", "name": "weight", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct IConfig.Config", "name": "config", "type": "tuple" }], "internalType": "struct IConfig.Route[]", "name": "routes_", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }]

module.exports = {
    ...PriceFeed,

    APP_NAME: 'token_price_feed',
    APP_ID: 100,
    REMOTE_CALL_TIMEOUT: 30000,


    getRoute: async function (config) {
        const w3 = networksWeb3[CHAINS.fantom]
        const configContract = new w3.eth.Contract(CONFIG_ABI, config)
        let routes = await configContract.methods.getRoutes().call();
        return {
            validPriceGap: routes.validPriceGap_,
            routes: routes.routes_.map((route) => {
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


    getEarliestBlockTimestamp: async function (toBlocks) {

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
                const routes = await this.getRoute(chainId, token)
                if (!routes) throw { message: 'Invalid token' }
                // calculate price using the given route
                const price = await this.calculatePrice(routes.validPriceGap, routes.routes, toBlocks)

                // get earliest block timestamp
                const timestamp = await this.getEarliestBlockTimestamp(toBlocks)

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

    hashRequestResult: function (request, result) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'signature': {

                let { config, price, timestamp } = result

                return soliditySha3([
                    { type: 'uint32', value: this.APP_ID },
                    { type: 'address', value: config },
                    { type: 'uint256', value: price },
                    { type: 'uint256', value: timestamp }
                ])

            }
            default:
                return null
        }
    }
}
