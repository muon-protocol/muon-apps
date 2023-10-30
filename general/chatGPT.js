const ChatGPTApp = {
    APP_NAME: 'chatGPT',
    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'isTrue': {
                let {
                    question,
                } = params;

                const answer = await this.askGPT(question);

                return {
                    answer,
                }
            }


            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'isTrue': {

                let {
                    answer
                } = result;

                return [
                    { type: 'bool', value: answer },
                ]
            }


            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = ChatGPTApp
