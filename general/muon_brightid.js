const { axios, toBN } = MuonAppUtils;

const BRIGHTID_NODES = [
  "http://brightid2.idealmoney.io/brightid",
  "http://brightid.idealmoney.io/brightid",
  "http://node.brightid.org/brightid",
];

module.exports = {
  APP_NAME: "muon_brightid",

  getContextIds: async function (context, contextId) {
    const results = await Promise.allSettled(
      BRIGHTID_NODES.map((url) =>
        axios.get(`${url}/v5/verifications/${context}/${contextId}`, {
          timeout: 10000,
        }),
      ),
    );
    return results
      .map((res) => res.value?.data?.data?.contextIds.join(","))
      .filter((res) => !!res);
  },

  onRequest: async function (request) {
    const {
      method,
      data: { params },
    } = request;
    let { context, contextId } = params;

    switch (method) {
      case "getContextIds":
        const responses = await this.getContextIds(context, contextId);
        let counts = responses.reduce((a, c) => {
          a[c] = (a[c] || 0) + 1;
          return a;
        }, {});
        let maxCount = Math.max(...Object.values(counts));
        let mostFrequent = Object.keys(counts).filter(
          (k) => counts[k] === maxCount,
        );

        if (maxCount >= 2) {
          return {
            contextIds: mostFrequent[0].split(","),
          };
        } else {
          throw new Error("Insufficient responses.");
        }

      default:
        throw new Error(`Unknown method ${method}`);
    }
  },

  signParams: function (request, result) {
    let { method } = request;
    let { contextIds } = result;

    switch (method) {
      case "getContextIds":
        return [{ type: "bytes32[]", value: contextIds }];

      default:
        throw new Error(`Unknown method ${method}`);
    }
  },
};
