const { soliditySha3 } = MuonAppUtils

module.exports = {
    APP_NAME: 'v3_oracle',

    onRequest: async function (request) {
        let { method } = request
        switch (method) {
            case 'signature':
                return {
                    testParam: "100", // uint256
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
        let { testParam } = result;
        switch (method) {
            case 'signature':
                return [
                    { type: 'uint256', value: testParam }
                ]
            default:
                break
        }
    }
}