const {axios, BN, toBaseUnit} = MuonAppUtils;
const subgraphUrl = "https://api.studio.thegraph.com/query/62454/vibe_rewarder/version/latest";

const Vibe = {
    APP_NAME: "vibe", useTss: true,

    postQuery: async function (query) {
        const {
            data: {data},
        } = await axios.post(subgraphUrl, {
            query: query,
        });
        return data;
    },

    getRakeback4User: async function (activeNftId, day_lte) {
        const query = `{
      dailyUserHistories(where: {activeNftId: "${activeNftId}", day_lte: "${day_lte}", referrerNftId_not: "0"}) {
        userRakebackShare
        day
      }
    }`;
        const data = await this.postQuery(query);
        let amount = new BN(0);

        for (let record of data.dailyUserHistories) {
            let userRakebackShareBN = new BN(record.userRakebackShare);
            amount = amount.add(userRakebackShareBN);
        }

        return amount
    },

    getRakeback4Referrer: async function (referrerNftId, day_lte) {
        const query = `{
      dailyUserHistories(where: {referrerNftId: "${referrerNftId}", day_lte: "${day_lte}"}) {
        userRakebackShare
        rakeback
        day
        activeNftId
      }
    }`;
        const data = await this.postQuery(query);
        let amount = new BN(0);

        for (let record of data.dailyUserHistories) {
            let userRakebackShareBN = new BN(record.userRakebackShare);
            let rakebackBN = new BN(record.rakeback);
            amount = amount.add(rakebackBN).sub(userRakebackShareBN);
        }

        return amount;
    },


    onRequest: async function (request) {
        let {
            method, data: {params = {}},
        } = request;
        let {nftId, timestamp} = params;
        const lastDay = Math.floor(timestamp / 86400);
        let amount;
        switch (method) {
            case "claim":
                let userRakeback = await this.getRakeback4User(nftId, lastDay);
                amount = userRakeback.toString();
                console.log(amount)
                return {nftId, amount, lastDay, timestamp, method};
            case "referralClaim":
                let referrerRakbake = await this.getRakeback4Referrer(nftId, lastDay);
                amount = referrerRakbake.toString();
                console.log(amount)
                return {nftId, amount, lastDay, timestamp, method};
            default:
                throw {message: `invalid method ${method}`};
        }
    },

    signParams: function (request, result) {
        let {nftId, amount, lastDay, timestamp, method} = result;
        switch (request.method) {
            case "claim":
                return [
                    {
                        name: "nftId",
                        type: "uint256",
                        value: nftId
                    }, {
                        name: "amount",
                        type: "uint256",
                        value: amount
                    }, {
                        name: "lastDay",
                        type: "uint256",
                        value: lastDay
                    }, {
                        name: "timestamp",
                        type: "uint256",
                        value: timestamp
                    }, {
                        name: "method",
                        type: "string",
                        value: method
                    }];
            case "referralClaim":
                return [
                    {
                        name: "nftId",
                        type: "uint256",
                        value: nftId
                    }, {
                        name: "amount",
                        type: "uint256",
                        value: amount
                    }, {
                        name: "lastDay",
                        type: "uint256",
                        value: lastDay
                    }, {
                        name: "timestamp",
                        type: "uint256",
                        value: timestamp
                    }, {
                        name: "method",
                        type: "string",
                        value: method
                    },];
            default:
                throw {message: `Unknown method: ${request.method}`};
        }
    },
};

module.exports = Vibe;
