const { Web3, soliditySha3, ethCall } = MuonAppUtils

module.exports = {
  APP_NAME: 'ai_safe_wallet',

  EXECUTOR: "0xb57490CDAABEDb450df33EfCdd93079A24ac5Ce5",

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request

    switch (method) {
      case 'verifyTX':
        let { 
          to,
          value,
          data,
          txGas,
          executorSign
        } = params

        const web3 = new Web3();

        const messageSigner = web3.eth.accounts.recover(
          soliditySha3(to, value, data, txGas),
          executorSign
        );

        if (this.EXECUTOR != messageSigner) {
          throw new Error("Invalid executor signature");
        }

        return {
          to: to.toString(),
          value: value.toString(),
          data: data.toString(),
          txGas: txGas.toString()
        }
      default:
        throw { message: `Unknown method ${method}` }
    }
  },

  signParams: function (request, result) {
    let { method } = request

    switch (method) {
      case 'verifyTX':
        let { 
          to, 
          value, 
          data, 
          txGas
        } = result

        return [
          { type: 'address', value: to },
          { type: 'uint256', value: value },
          { type: 'bytes', value: data },
          { type: 'uint256', value: txGas },
        ]
      default:
        throw { message: `Unknown method: ${method}` }
    }
  }
}
