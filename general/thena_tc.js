const { } = MuonAppUtils

const ThenaTCApp = {
    APP_NAME: 'thena_tc',

    onRequest: async function (request) {
        let { method, data: { params } } = request;

        let { owner, idCounter } = params

        switch (method) {
            case 'info':
                await this.checkUser(owner, idCounter);
                const finalBalance = await this.getFinalBalance(owner, idCounter);
                const { startingBalance, depositFromOwner, depositNotFromOwner } = await this.getInfo(owner, idCounter);
                return {
                    finalBalance,
                    startingBalance,
                    depositFromOwner,
                    depositNotFromOwner,
                };
            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'info':
                const {
                    finalBalance,
                    startingBalance,
                    depositFromOwner,
                    depositNotFromOwner,
                } = result;
                return [
                    { type: 'uint256', value: finalBalance },
                    { type: 'uint256', value: startingBalance },
                    { type: 'uint256', value: depositFromOwner },
                    { type: 'uint256', value: depositNotFromOwner },
                ]
            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = ThenaTCApp
