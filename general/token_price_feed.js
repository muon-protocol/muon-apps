const { toBaseUnit, soliditySha3, BN, ethCall } = MuonAppUtils

const CHAINS = {
    mainnet: 1,
    fantom: 250,
}

const ROUTES = {
    [CHAINS.mainnet]: {
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': ['0xEBFb684dD2b01E698ca6c14F10e4f289934a54D6']
    },
    [CHAINS.fantom]: {
        '0xDE5ed76E7c05eC5e4572CfC88d1ACEA165109E44': ['0x2599Eba5fD1e49F294C76D034557948034d6C96E', '0xe7E90f5a767406efF87Fdad7EB07ef407922EC1D']
    },
}

const PRICE_TOLERANCE = '0.0005'
const Q112 = new BN(2).pow(new BN(112))

const UNISWAPV2_PAIR_ABI = [{ "constant": true, "inputs": [], "name": "token0", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "token1", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }]

module.exports = {
    APP_NAME: 'token_price_feed',
    APP_ID: 100,
    REMOTE_CALL_TIMEOUT: 30000,


    isPriceToleranceOk: function (price, expectedPrice, priceTolerance) {
        let priceDiff = new BN(price).sub(new BN(expectedPrice)).abs()

        if (
            new BN(priceDiff).mul(toBaseUnit('1', '18'))
                .div(new BN(expectedPrice))
                .gt(toBaseUnit(priceTolerance, '18'))
        ) {
            return false
        }
        return true
    },

    getRoute: function (chainId, tokenAddress) {
        return ROUTES[chainId][tokenAddress]
    },

    getTokenPairPrice: async function (chain, pairAddress, tokenAddress) {
        let request = {
            method: 'signature',
            data: {
                params: {
                    chain: chain,
                    pairAddress: pairAddress,
                }
            }
        }

        let pairPrice = await this.invoke("price_feed", "onRequest", request)
        let token0 = await ethCall(pairAddress, 'token0', [], UNISWAPV2_PAIR_ABI, CHAINS[chain])
        let token1 = await ethCall(pairAddress, 'token1', [], UNISWAPV2_PAIR_ABI, CHAINS[chain])
        if (tokenAddress == token0) return { price: new BN(pairPrice.price0), token: token1 }
        return { price: new BN(pairPrice.price1), unitToken: token0 }
    },

    calculatePrice: async function (chain, route, tokenAddress) {
        let price = Q112
        let tokenPairPrice = { unitToken: tokenAddress }
        for (var pairAddress of route) {
            tokenPairPrice = await this.getTokenPairPrice(chain, pairAddress, tokenPairPrice.unitToken)
            price = price.mul(tokenPairPrice.price).div(Q112)
        }
        return price
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request

        switch (method) {
            case 'signature':

                let { chain, tokenAddress } = params
                if (!chain) throw { message: 'Invalid chain' }

                const chainId = CHAINS[chain]

                // get token route for calculating price
                const route = this.getRoute(chainId, tokenAddress)
                if (!route) throw { message: 'Invalid token' }
                // calculate price using the given route
                const price = await this.calculatePrice(chain, route, tokenAddress)

                return {
                    chain: chain,
                    tokenAddress: tokenAddress,
                    route: route,
                    price: price.toString()
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

                let { chain, tokenAddress, route, price } = result

                const expectedPrice = request.data.result.price

                if (!this.isPriceToleranceOk(price, expectedPrice, PRICE_TOLERANCE)) throw { message: 'Price threshold exceeded' }

                return soliditySha3([
                    { type: 'uint32', value: this.APP_ID },
                    { type: 'address', value: tokenAddress },
                    { type: 'address[]', value: route },
                    { type: 'uint256', value: expectedPrice },
                    { type: 'uint256', value: String(CHAINS[chain]) },
                    { type: 'uint256', value: request.data.timestamp }
                ])

            }
            default:
                return null
        }
    }
}
