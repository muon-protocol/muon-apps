const { } = MuonAppUtils

const ThenaTCApp = {
    APP_NAME: 'thena_tc',

    onRequest: async function (request) {
        let { method, data: { params } } = request;

        let { owner, idCounter } = params

        switch (method) {
            case 'info':
                // gets AccountManager address and create instance of it
                const accountManager = new AccountManager(await this.getAccountManager(idCounter));
                // checks if user is valid
                const isValid = await accountManager.isAccountValid(owner);
                if (!isValid) throw { message: "NOT_VALID_USER" }
                // gets final balance of user
                const finalBalance = await accountManager.getBalanceOfUser(owner);
                // gets user info from subgraph
                const { startingBalance, depositFromOwner, depositNotFromOwner } = await this.getInfo(owner, idCounter);
                // returns outputs
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
