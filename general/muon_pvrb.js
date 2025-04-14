const { axios, soliditySha3, floatToBN } = MuonAppUtils

/**
 * PVRB(Publicly Verifiable Random Beacon) using Muon
 *
 * 1- The app gets a message from the client or load it
 * from a trusted public source
 *
 * 2- Calculates the TSS signature
 *
 * 3- The signature is random and verifiable and could be
 * considered as the random seed by the client 
 */

module.exports = {
  APP_NAME: 'muon_pvrb',

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request
    switch (method) {
      case 'pvrb':
        let { message } = params;

        /*
         * 'message' could be loaded from another source.
         * For example on smart contracts, the message could
         * be the previous random number that is saved on the chain.
        */

        return {
          message: message
        }

      default:
        throw { message: `Unknown method ${params}` }
    }
  },

  signParams: function(request, result){
    let { method } = request;
    let { message } = result;
    switch (method) {
      case 'pvrb':
        return [
          { type: 'string', value: message}
        ]
      default:
        break
    }
  }
}
