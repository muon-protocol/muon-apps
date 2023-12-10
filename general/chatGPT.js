const { axios } = MuonAppUtils

const gptUrl = 'https://api.openai.com/v1/chat/completions'
const OPENAI_API_KEY = process.env.GPT_API_KEY

const ChatGPTApp = {
    APP_NAME: 'chatGPT',

    askGPT: async function (question) {
        try {
            const { data: completion } = await axios.post(gptUrl, {
                messages: [
                    { role: "system", content: "Answer with true or false." },
                    { role: "user", content: question }
                ],
                model: "gpt-3.5-turbo",
            },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    },
                })

            let answer = completion.choices[0].message.content;
            if (!(["True.", "False.", "False", "True"].includes(answer))) {
                throw { message: "GPT_NOT_ANSWERED_WITH_TRUE_OR_FALSE" }
            }

            answer = answer == "True." ? true : false;

            return answer
        }
        catch (e) {
            console.log(e)
            throw { message: "FAILED_TO_REACH_GPT" }
        }
    },

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
