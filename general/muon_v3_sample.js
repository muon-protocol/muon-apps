const {soliditySha3} = MuonAppUtils

module.exports = {
  APP_NAME: 'muon_v3_sample',

  onRequest: async (request) => {
    let { method } = request
    switch (method) {
      case 'test':
        return {
          testParam: 100, // uint256
        }

      default:
        throw { message: `Unknown method ${params}` }
    }
  },

  hashRequestResult: (request, result) => {
    let { method } = request
    switch (method) {
      case 'test':
        let { testParam } = result;
        return soliditySha3([
          { type: 'uint32', value: this.APP_ID },
          // request.hash is the reqId that goes to the chain
          // it is deterministic and can be signed
          { type: 'bytes', value: request.hash},
          { type: 'uint256', value: testParam}
        ])

      default:
        break
    }
  }
}
