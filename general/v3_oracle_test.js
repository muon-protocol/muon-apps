const { BN, toBaseUnit } = MuonAppUtils

module.exports = {
    APP_NAME: 'v3_oracle_test',

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'signature':
                let { positionIds, bidPrices, askPrices, hashTimestamp } = params

                positionIds = JSON.parse(positionIds)
                bidPrices = JSON.parse(bidPrices)
                askPrices = JSON.parse(askPrices)
                if (hashTimestamp) hashTimestamp = JSON.parse(hashTimestamp)

                return {
                    positionIds,
                    bidPrices,
                    askPrices,
                    hashTimestamp,
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
        let { method } = request;
        switch (method) {
            case 'signature':
                let { positionIds, bidPrices, askPrices, hashTimestamp } = result;
                return [
                    { type: 'uint256[]', value: positionIds },
                    { type: 'uint256[]', value: bidPrices },
                    { type: 'uint256[]', value: askPrices },
                    ...(hashTimestamp == undefined || hashTimestamp == true
                        ? [{ type: 'uint256', value: request.data.timestamp }]
                        : [])
                ]
            default:
                break
        }
    }
}