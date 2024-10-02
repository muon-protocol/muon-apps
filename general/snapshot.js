const { axios } = MuonAppUtils

const SPACE_ID = "pion-network.eth";

const SnapshotApp = {
    APP_NAME: 'snapshot',
    useFrost: true,

    getProposal: async function (proposalId) {
        const url = `https://hub.snapshot.org/graphql?`;
        const query = `
            query Proposal($id: String!) {
                proposal(id: $id) {
                    choices
                    scores
                    scores_total
                    space {
                        id
                    }
                    state
                }
            }
        `;
        try {
            const result = await axios.post(url, {
                operationName: "Proposal",
                query: query,
                variables: {
                    id: `${proposalId}`
                }
            });
            return result.data.data.proposal;
        } catch (e) {
            throw e
        }
    },

    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'proposal-result': {
                let {
                    proposalId
                } = params;

                if(!proposalId) {
                    throw { message: "Invalid proposalId"};
                }

                const proposal = await this.getProposal(proposalId);

                if(!proposal) {
                    throw { message: "Couldn't get the proposal" };
                }

                let { 
                    choices, 
                    scores, 
                    scores_total, 
                    space, 
                    state 
                } = proposal;

                choices = choices.map(c => c.toLowerCase());

                if(space.id != SPACE_ID) {
                    throw { message: "Invalid voting space" };
                }
                if(state != "closed") {
                    throw { message: "Voting is not closed yet" };
                }
                if(choices.length != 2 || !choices.includes("yes") || !choices.includes("no")) {
                    throw { message: "Invalid proposal choices" };
                }

                let result = 0;
                choices.map((choice, i) => {
                    if(choice == "yes") {
                        result = parseFloat(scores[i] * 100/scores_total).toFixed(2);
                    }
                })

                return {
                    result: result.toString()
                }
            }
            case 'proposal-validation': {
                let {
                    proposalId
                } = params;

                if(!proposalId) {
                    throw { message: "Invalid proposalId"};
                }

                const proposal = await this.getProposal(proposalId);

                if(!proposal) {
                    throw { message: "Couldn't get the proposal" };
                }

                let { 
                    choices,
                    space,
                } = proposal;

                choices = choices.map(c => c.toLowerCase());

                if(space.id != SPACE_ID) {
                    throw { message: "Invalid voting space" };
                }
                if(choices.length != 2 || !choices.includes("yes") || !choices.includes("no")) {
                    throw { message: "Invalid proposal choices" };
                }

                return {
                    proposalId: proposalId.toString()
                }
            }
            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'proposal-result': {
                let {
                    result: proposalResult,
                } = result

                return [
                    { type: 'string', value: proposalResult }
                ]
            }
            case 'proposal-validation': {
                let {
                    proposalId,
                } = result

                return [
                    { type: 'string', value: proposalId }
                ]
            }
            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = SnapshotApp
