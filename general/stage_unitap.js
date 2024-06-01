const { axios, ethCall } = MuonAppUtils

const PRIZE_TAP_VRF_CLIENT = {
    chainId: 97,
    address: "0xb8B0c04282d9c55cb17d7ef0bF56ef3Bbe203F3C",
    abi: [{ "inputs": [{ "internalType": "uint256", "name": "requestId", "type": "uint256" }], "name": "getRandomWords", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "lastRequestId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "vrfRequests", "outputs": [{ "internalType": "uint256", "name": "expirationTime", "type": "uint256" }, { "internalType": "uint256", "name": "numWords", "type": "uint256" }], "stateMutability": "view", "type": "function" }]
}

const PRIZE_TAP_RAFFLE = [{ "inputs": [{ "internalType": "uint256", "name": "raffleId", "type": "uint256" }], "name": "getWinnersCount", "outputs": [{ "internalType": "uint256", "name": "winnersCount", "type": "uint256" }], "stateMutability": "view", "type": "function" }]

const StageUnitapApp = {
    APP_NAME: 'stage_unitap',

    getEntryDetail: async function (raffleEntryId) {
        const url = `https://stage.unitap.app/api/prizetap/raffle-enrollment/detail/${raffleEntryId}/`
        let result
        try {
            result = await axios.get(url, {
                headers: { "Accept-Encoding": "gzip,deflate,compress" }
            })
        }

        catch (e) {
            throw e.response.data
        }

        const { chain, userWalletAddress, multiplier, raffle } = result.data.entry
        const { raffleId, contract } = raffle

        if (chain && userWalletAddress && multiplier && raffleId) {
            return {
                chain,
                contract,
                wallet: userWalletAddress,
                raffleId,
                multiplier,
            }
        }

        else throw { detail: 'CORRUPTED_ENTRY' }
    },

    getWinnersCount: async function (chainId, raffelId, prizetapRaffle) {
        const winnersCount = await ethCall(prizetapRaffle, 'getWinnersCount', [raffelId], PRIZE_TAP_RAFFLE, chainId)
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

    getTokenTapClaim: async function (claimId) {
        const url = `https://stage.unitap.app/api/tokentap/claim-detail/${claimId}/`
        let result
        try {
            result = await axios.get(url, {
                headers: { "Accept-Encoding": "gzip,deflate,compress" }
            })
        } catch (e) {
            throw e.response.data
        }

        const { tokenDistribution, userWalletAddress } = result.data.data
        const { chain: { chainId }, distributionId, contract } = tokenDistribution

        if (chainId && userWalletAddress && distributionId && contract) {
            return {
                chain: chainId,
                contract,
                wallet: userWalletAddress,
                distributionId
            }
        }

        else throw { detail: 'INVALID_CLAIM_ENTRY' }
    },

    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'raffle-entry': {
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
            case 'claim-token': {
                let {
                    claimId
                } = params

                const { 
                    chain,
                    contract,
                    wallet,
                    distributionId
                } = await this.getTokenTapClaim(claimId);

                return {
                    chain,
                    contract,
                    wallet,
                    distributionId,
                    claimId
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

            case 'random-words': {
                let {
                    randomWords,
                    expirationTime,
                } = result


                return [
                    { type: 'uint256[]', value: randomWords },
                    { type: 'uint256', value: expirationTime },
                ]
            }

            case 'claim-token': {
                let {
                    chain,
                    contract,
                    wallet,
                    distributionId,
                    claimId
                } = result

                return [
                    { type: 'uint256', value: chain },
                    { type: 'address', value: contract },
                    { type: 'address', value: wallet },
                    { type: 'uint256', value: distributionId },
                    { type: 'uint256', value: claimId },
                ]
            }

            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = StageUnitapApp
