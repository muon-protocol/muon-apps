const { soliditySha3 } = MuonAppUtils;

module.exports = {
  APP_NAME: "immutable_app_sample",

  onRequest: async function(request) {
    let { method } = request;
    switch (method) {
      case "test":
        return {
          testParam: "100", // uint256

          // CID of the app file
          // Immutable apps should use it
          appCID: await this.APP_CID
        };

      default:
        throw { message: `Unknown method ${params}` };
    }
  },

  signParams: function(request, result) {
    let { method } = request;
    let { testParam, appCID } = result;
    switch (method) {
      case "test":
        return [
          { type: "bytes", value: appCID },
          { type: "uint256", value: testParam }
        ];
      default:
        break;
    }
  },
};
