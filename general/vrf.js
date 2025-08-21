const VRFApp = {
    APP_NAME: 'vrf',

    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'random-number':
                let {
                    chainId,
                    requestId,
                    blockNum,
                    callbackGasLimit,
                    numWords,
                    consumer,
                } = params

                return {
                    chainId,
                    requestId,
                    blockNum,
                    callbackGasLimit,
                    numWords,
                    consumer,
                }

            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'random-number': {

                let {
                    chainId,
                    requestId,
                    blockNum,
                    callbackGasLimit,
                    numWords,
                    consumer,
                } = result

                return [
                    { type: 'uint256', value: chainId },
                    { type: 'uint256', value: requestId },
                    { type: 'uint256', value: blockNum },
                    { type: 'uint32', value: callbackGasLimit },
                    { type: 'uint32', value: numWords },
                    { type: 'address', value: consumer },
                ]
            }

            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = VRFApp
