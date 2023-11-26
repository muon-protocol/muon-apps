const { } = MuonAppUtils

const ThenaTCApp = {
    APP_NAME: 'thena_tc',

    onRequest: async function (request) {
        let { method, data: { params } } = request;

        let { owner, idCounter } = params

        switch (method) {
            case 'info':
                return;
            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'info':
                return;
            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = ThenaTCApp
