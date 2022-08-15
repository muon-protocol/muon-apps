const { toBaseUnit, soliditySha3, BN } = MuonAppUtils

const CHAINS = {
    mainnet: 1,
    fantom: 250,
}

const PRICE_TOLERANCE = '0.0005'

const UNISWAPV2_PAIR_ABI = [{ "constant": true, "inputs": [], "name": "getReserves", "outputs": [{ "internalType": "uint112", "name": "_reserve0", "type": "uint112" }, { "internalType": "uint112", "name": "_reserve1", "type": "uint112" }, { "internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32" }], "payable": false, "stateMutability": "view", "type": "function" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint112", "name": "reserve0", "type": "uint112" }, { "indexed": false, "internalType": "uint112", "name": "reserve1", "type": "uint112" }], "name": "Sync", "type": "event" }]

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

    },

    calculatePrice: async function (route, tokenAddress) {

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
                const price = await this.calculatePrice(route, tokenAddress)

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
