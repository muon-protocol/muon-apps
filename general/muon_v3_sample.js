const {soliditySha3} = MuonAppUtils

module.exports = {
  APP_NAME: 'muon_v3_sample',

  onRequest: async function(request){
    let { method } = request
    switch (method) {
      case 'test':
        return {
          testParam: "100", // uint256
        }

      default:
        throw { message: `Unknown method ${params}` }
    }
  },

  // Deprecated in favor of signParams

  // hashRequestResult: function(request, result){
  //   let { method } = request
  //   switch (method) {
  //     case 'test':
  //       let { testParam } = result;
  //       console.log(this.APP_ID, request.hash, testParam)
  //       return soliditySha3([
  //         { type: 'uint32', value: this.APP_ID },
  //         // request.hash is the reqId that goes to the chain
  //         // it is deterministic and can be signed
  //         { type: 'bytes', value: request.hash},
  //         { type: 'uint256', value: testParam}
  //       ])

  //     default:
  //       break
  //   }
  // }

  /**
   * List of the parameters that need to be signed. 
   * APP_ID, reqId will be added by the
   * Muon Core and [APP_ID, reqId, … signParams]
   * should be verified on chain.
   */
  signParams: function(request, result){
    let { method } = request;
    let { testParam } = result;
    switch (method) {
      case 'test':
        return [
          { type: 'uint256', value: testParam}
        ]
      default:
        break
    }
  }
}
