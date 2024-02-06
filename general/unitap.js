const { axios, ethCall } = MuonAppUtils

const PRIZE_TAP_VRF_CLIENT = {
    chainId: 137,
    address: "0xd713f3584EADc92848d64C31fD66CD50AdF272CD",
    abi: [{ "inputs": [{ "internalType": "uint256", "name": "requestId", "type": "uint256" }], "name": "getRandomWords", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "lastRequestId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "vrfRequests", "outputs": [{ "internalType": "uint256", "name": "expirationTime", "type": "uint256" }, { "internalType": "uint256", "name": "numWords", "type": "uint256" }], "stateMutability": "view", "type": "function" }]
}

const PRIZE_TAP_RAFFLE = [{ "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "raffles", "outputs": [{ "internalType": "address", "name": "initiator", "type": "address" }, { "internalType": "uint256", "name": "maxParticipants", "type": "uint256" }, { "internalType": "uint256", "name": "maxMultiplier", "type": "uint256" }, { "internalType": "uint256", "name": "startTime", "type": "uint256" }, { "internalType": "uint256", "name": "endTime", "type": "uint256" }, { "internalType": "uint256", "name": "participantsCount", "type": "uint256" }, { "internalType": "uint32", "name": "winnersCount", "type": "uint32" }, { "internalType": "bool", "name": "exists", "type": "bool" }, { "internalType": "enum AbstractPrizetapRaffle.Status", "name": "status", "type": "uint8" }, { "internalType": "bytes32", "name": "requirementsHash", "type": "bytes32" }], "stateMutability": "view", "type": "function" }]

const UnitapApp = {
    APP_NAME: 'unitap',

    getEntryDetail: async function (raffleEntryId) {
        const url = `https://api.unitap.app/api/prizetap/raffle-enrollment/detail/${raffleEntryId}/`
        let result
        try {
            result = await axios.get(url, {
                headers: { "Accept-Encoding": "gzip,deflate,compress" }
            })
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

    getWinnersCount: async function (chainId, raffelId, prizetapRaffle) {
        const { winnersCount } = await ethCall(prizetapRaffle, 'raffles', [raffelId], PRIZE_TAP_RAFFLE, chainId)
        if (winnersCount == 0) {
            throw { detail: 'INVALID_RAFFLE_ID' }
        }
        return { winnersCount }
    },

    getRandomWords: async function (winnersCount) {
        const lastRequestId = await ethCall(PRIZE_TAP_VRF_CLIENT.address, 'lastRequestId', [], PRIZE_TAP_VRF_CLIENT.abi, PRIZE_TAP_VRF_CLIENT.chainId)
        const { expirationTime, numWords } = await ethCall(PRIZE_TAP_VRF_CLIENT.address, 'vrfRequests', [lastRequestId], PRIZE_TAP_VRF_CLIENT.abi, PRIZE_TAP_VRF_CLIENT.chainId)

        if (numWords != winnersCount) {
            throw { detail: 'INVALID_RANDOM_WORDS_LENGTH' }
        }
        if (Math.floor(Date.now() / 1000) >= expirationTime) {
            throw { detail: 'EXPIRED_RANDOM_WORDS' }
        }

        const randomWords = await ethCall(PRIZE_TAP_VRF_CLIENT.address, 'getRandomWords', [lastRequestId], PRIZE_TAP_VRF_CLIENT.abi, PRIZE_TAP_VRF_CLIENT.chainId)
        if (randomWords.length == 0) {
            throw {
                detail: 'NO_RANDOM_WORDS_FOUND',
            }
        }
        return { randomWords, expirationTime }
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

            case 'random-words': {
                let {
                    chainId,
                    prizetapRaffle,
                    raffleId,
                } = params

                const { winnersCount } = await this.getWinnersCount(chainId, raffleId, prizetapRaffle)
                const { randomWords, expirationTime } = await this.getRandomWords(winnersCount)

                return {
                    randomWords,
                    expirationTime,
                }
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
                    randomWords,
                    expirationTime,
                } = result


                return [
                    { type: 'uint256[]', value: randomWords },
                    { type: 'uint256', value: expirationTime },
                ]

            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = UnitapApp
