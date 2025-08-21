const { axios } = MuonAppUtils

const chatGptUrl = 'https://api.openai.com/v1/chat/completions';
const chatGptModel = "gpt-4-1106-preview";
const OPENAI_API_KEY = process.env.GPT_API_KEY

const pplxUrl = "https://api.perplexity.ai/chat/completions";
const PPLX_API_KEY = process.env.PPLX_API_KEY;
const pplxModel = "sonar";

const GPTApp = {
    APP_NAME: 'factGPT',

    askGPT: async function (question, gptUrl, model, apiKey) {
        try {
            const { data: completion } = await axios.post(gptUrl, {
                messages: [
                    { role: "system", content: "true/false responses only. No additional words." },
                    { role: "user", content: question + 
                        "\ntrue/false responses only. No additional words."
                    }
                ],
                model: model,
            },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                    },
                })

            let answer = completion.choices[0].message.content;
            if (!(["True.", "False.", "False", "True"].includes(answer))) {
                throw { message: "GPT_NOT_ANSWERED_WITH_TRUE_OR_FALSE", answer }
            }

            answer = ["True.", "True"].includes(answer) ? true : false;

            return answer
        }
        catch (e) {
            throw { message: e.message ? e.message : "FAILED_TO_REACH_GPT" }
        }
    },



    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'verifyChatGPT': {
                let {
                    question,
                } = params;

                const answer = await this.askGPT(
                    question,
                    chatGptUrl,
                    chatGptModel,
                    OPENAI_API_KEY
                );
                console.log('answer', answer)

                return {
                    answer,
                }
            }

            case 'verify': {
                let {
                    question,
                } = params;

                const answer = await this.askGPT(
                    question,
                    pplxUrl,
                    pplxModel,
                    PPLX_API_KEY
                );
                console.log('answer', answer)

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
            case 'verify': {

                let {
                    answer
                } = result;

                return [
                    { type: 'bool', value: answer },
                ]
            }

            case 'verifyRealtime': {

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

module.exports = GPTApp
