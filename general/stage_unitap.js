const { axios } = MuonAppUtils

const StageUnitapApp = {
    APP_NAME: 'stage_unitap',

    getEntryDetail: async function (raffleEntryId) {
        const url = `https://stage.unitap.app/api/prizetap/raffle-enrollment/detail/${raffleEntryId}/`
        let result
        try {
            result = await axios.get(url)
        }

        catch (e) {
            throw e.response.data
        }

        const { chain, wallet, multiplier, raffle } = result.data.entry
        const { raffleId, contract } = raffle

        if (chain && wallet && multiplier && raffleId) {
            return {
                chain,
                contract,
                wallet,
                raffleId,
                multiplier,
            }
        }

        else throw { detail: 'CORRUPTED_ENTRY' }
    },

    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'raffle-entry':
                let {
                    raffleEntryId
                } = params

                const {
                    chain,
                    contract,
                    wallet,
                    raffleId,
                    multiplier,
                } = await this.getEntryDetail(raffleEntryId)

                return {
                    chain,
                    contract,
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
                    contract,
                    wallet,
                    raffleId,
                    multiplier,
                } = result

                return [
                    { type: 'uint256', value: chain },
                    { type: 'address', value: contract },
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

module.exports = StageUnitapApp
