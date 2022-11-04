const { BN, toBaseUnit } = MuonAppUtils

module.exports = {
    APP_NAME: 'dibs',

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case '':

                return {}

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
            case '':
                return []
            default:
                break
        }
    }
}