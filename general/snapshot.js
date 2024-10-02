const { axios } = MuonAppUtils

const SnapshotApp = {
    APP_NAME: 'snapshot',
    useFrost: true,

    getProposal: async function (proposalId) {
        const url = `https://hub.snapshot.org/graphql?`;
        const query = `
            query Proposal {
                proposal(id:"${proposalId}") {
                    votes
                }
            }
        `;
        try {
            const result = await axios.post(url, {
                operationName: "Proposal",
                query: query,
                variables: null
            });
            return result.data.data.proposal;
        } catch (e) {
            throw e
        }
    },

    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'proposal-votes': {
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

                const { votes } = proposal;

                return {
                    votes: votes.toString()
                }
            }
            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'proposal-votes': {
                let {
                    votes,
                } = result

                return [
                    { type: 'uint256', value: votes }
                ]
            }
            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = SnapshotApp
