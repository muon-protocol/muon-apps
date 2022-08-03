const { axios, soliditySha3, BN } = MuonAppUtils

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
    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request

        switch (method) {
            case 'signature':

                return {}

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

                return soliditySha3([])

            }
            default:
                return null
        }
    }
}
