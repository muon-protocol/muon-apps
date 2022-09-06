const { BN, soliditySha3, toBaseUnit } = MuonAppUtils

const CHAINS = {
    mainnet: 1,
    fantom: 250,
}

const ETH = new BN(toBaseUnit('1', '18'))

module.exports = {
    APP_NAME: 'v3_oracle',
    APP_ID: 300,

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'signature':
                let { chain } = params
                const chainId = CHAINS[chain]
                const marketPrices = [
                    {
                        marketId: 1,
                        bidPrice: ETH,
                        askPrice: ETH,
                    },
                ]
                return {
                    chainId, // uint256
                    marketPrices,
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
                let { chainId, marketPrices } = result;
                let marketIds = []
                let bidPrices = []
                let askPrices = []
                marketPrices.forEach((marketPrice) => {
                    marketIds.push(marketPrice.marketId)
                    bidPrices.push(marketPrice.bidPrice)
                    askPrices.push(marketPrice.askPrice)
                })

                return [
                    { type: 'uint32', value: this.APP_ID },
                    { type: 'uint256', value: chainId },
                    { type: 'uint256[]', value: marketIds },
                    { type: 'uint256[]', value: bidPrices },
                    { type: 'uint256[]', value: askPrices },
                    { type: 'uint256', value: request.data.timestamp },
                ]
            default:
                break
        }
    }
}