const { axios, ethCall, BN, toBaseUnit } = MuonAppUtils

const DibsRepository = "0x1f05D4C5BAAFa5a10b81D9890e32825025Ca2eAD"
const DIBS_REPO_ABI = [{ "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "projects", "outputs": [{ "internalType": "uint256", "name": "chainId", "type": "uint256" }, { "internalType": "address", "name": "dibs", "type": "address" }, { "internalType": "string", "name": "subgraphEndpoint", "type": "string" }, { "internalType": "uint32", "name": "firstRoundStartTime", "type": "uint32" }, { "internalType": "uint32", "name": "roundDuration", "type": "uint32" }, { "internalType": "bool", "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "roundId", "type": "bytes32" }], "name": "getSeed", "outputs": [{ "internalType": "bool", "name": "fulfilled", "type": "bool" }, { "internalType": "uint256", "name": "seed", "type": "uint256" }], "stateMutability": "view", "type": "function" }]

const scaleUp = (value) => new BN(toBaseUnit(String(value), 18))
const VALID_TOLERANCE = scaleUp('0.01')
const SCALE = scaleUp('1')

module.exports = {
    APP_NAME: 'bmxTrade2Earn',
    useFrost: true,

    isToleranceOk: function (amount, expectedAmount, validTolerance) {
        let diff = new BN(amount).sub(new BN(expectedAmount)).abs()
        const diffPercentage = new BN(diff).mul(SCALE).div(new BN(expectedAmount))
        return {
            isOk: !diffPercentage.gt(new BN(validTolerance)),
            diffPercentage: diffPercentage.mul(new BN(100)).div(SCALE)
        }
    },

    postQuery: async function (query, subgraphEndpoint) {
        const result = await axios.post(subgraphEndpoint, {
            query: query
        })

        const data = result.data

        if (data.errors) {
            throw data.errors
        }

        return data.data
    },


    fetchProject: async function (projectId) {
        const { dibs, chainId, subgraphEndpoint } = await ethCall(DibsRepository, 'projects', [projectId], DIBS_REPO_ABI, 8453)
        return { dibs, chainId, subgraphEndpoint }
    },


    getDailyVolume: async function (user, pair, day, subgraphEndpoint) {
        const totalQuery = `{
            totalVolume: dailyGeneratedVolumes(where:{day: ${day}, user: "0x0000000000000000000000000000000000000000", pair: "${pair.toLowerCase()}", amountAsReferrer_gt: "0"}) {
              id
              user
              amountAsUser
              day
            } 
        }`

        const userQuery = `{
            userVolume: dailyGeneratedVolumes(where:{day: ${day}, user: "${user.toLowerCase()}", pair: "${pair.toLowerCase()}", amountAsReferrer_gt: "0"}) {
              id
              user
              amountAsUser
              day
            } 
        }`

        const totalData = (await this.postQuery(totalQuery, subgraphEndpoint)).totalVolume
        const userData = (await this.postQuery(userQuery, subgraphEndpoint)).userVolume

        if (userData.length == 0) throw { message: `NO_RECORD_FOR_USER` }
        if (totalData.length == 0) throw { message: `NO_RECORD_FOR_PLATFORM` }

        const totalVolume = totalData[0].amountAsUser
        const userVolume = userData[0].amountAsUser

        return {
            userVolume,
            totalVolume,
        }
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {

            case 'userVolume': {
                let {
                    projectId,
                    user,
                    pair,
                    day
                } = params

                if (parseInt(day) < 0) throw { message: 'NEGATIVE_DAY' }

                const { subgraphEndpoint } = await this.fetchProject(projectId)
                const { userVolume, totalVolume } = await this.getDailyVolume(user, pair, day, subgraphEndpoint)

                return {
                    projectId,
                    user,
                    pair,
                    day,
                    userVolume,
                    totalVolume,
                }
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

            case 'userVolume': {
                let {
                    projectId,
                    user,
                    pair,
                    day,
                    userVolume,
                    totalVolume,
                } = result

                if (!this.isToleranceOk(userVolume, request.data.result.userVolume, VALID_TOLERANCE).isOk)
                    throw { message: `Tolerance Error - user volume` }
                if (!this.isToleranceOk(totalVolume, request.data.result.totalVolume, VALID_TOLERANCE).isOk)
                    throw { message: `Tolerance Error - total volume` }

                return [
                    { type: 'bytes32', value: projectId },
                    { type: 'address', value: user },
                    { type: 'address', value: pair },
                    { type: 'uint256', value: day },
                    { type: 'uint256', value: request.data.result.userVolume },
                    { type: 'uint256', value: request.data.result.totalVolume },
                    { type: 'uint256', value: request.data.timestamp },
                ]
            }

            default:
                break
        }
    }
}
