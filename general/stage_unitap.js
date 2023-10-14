const { axios, ethCall } = MuonAppUtils

const PRIZE_TAP_VRF_CLIENT = "0xdf60b75E3974BBFD60CF0d7e05e09C9CdddC0994"
const PRIZE_TAP_VRF_CLIENT_ABI = [{ "inputs": [{ "internalType": "uint256", "name": "requestId", "type": "uint256" }], "name": "getRandomWords", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" }]

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

    getRandomWords: async function (requestId) {
        const randomWords = await ethCall(PRIZE_TAP_VRF_CLIENT, 'getRandomWords', [requestId], PRIZE_TAP_VRF_CLIENT_ABI, 80001)
        if (randomWords.length == 0) {
            throw {
                detail: 'NO_RECORD_FOUND',
            }
        }
        return { randomWords }
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

            case 'random-words':
                let {
                    requestId,
                } = params

                const { randomWords } = await this.getRandomWords(requestId)

                return {
                    requestId,
                    randomWords,
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

            case 'random-words':
                let {
                    requestId,
                    randomWords,
                } = result


                return [
                    { type: 'uint256', value: requestId },
                    { type: 'uint256[]', value: randomWords },
                ]

            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = StageUnitapApp
