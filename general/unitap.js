const UnitapApp = {
    APP_NAME: 'unitap',

    getEntryDetail: async function (raffleEntryId) {

    },

    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'raffle-entry':
                let {
                    raffleEntryId
                } = params

                const { chain, wallet, raffleId, multiplier } = await this.getEntryDetail(raffleEntryId)

                return {
                    chain,
                    wallet,
                    raffleId,
                    multiplier,
                }

            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'raffle-entry': {

                let {
                    chain,
                    wallet,
                    raffleId,
                    multiplier,
                } = result

                return [
                    { type: 'uint256', value: chain },
                    { type: 'address', value: wallet },
                    { type: 'uint256', value: raffleId },
                    { type: 'uint256', value: multiplier },
                ]
            }

            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = UnitapApp
