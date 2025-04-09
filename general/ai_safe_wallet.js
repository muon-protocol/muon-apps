const { Web3 } = MuonAppUtils

module.exports = {
  APP_NAME: 'ai_safe_wallet',

  EXECUTOR: "0x43473CF3B1F0b9A0407405343df6a03AED1d107e",

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request

    switch (method) {
      case 'verifyTX':
        let {
          chainId, 
          to,
          value,
          data,
          txGas,
          nonce,
          executorSign
        } = params

        const web3 = new Web3();

        const messageSigner = web3.eth.accounts.recover(
          web3.utils.soliditySha3(chainId, to, value, data, txGas, nonce),
          executorSign
        );

        if (this.EXECUTOR != messageSigner) {
          throw new Error("Invalid executor signature");
        }

        return {
          chainId: chainId.toString(),
          to: to.toString(),
          value: value.toString(),
          data: data.toString(),
          txGas: txGas.toString(),
          nonce: nonce.toString()
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
          chainId,
          to, 
          value, 
          data, 
          txGas,
          nonce
        } = result

        return [
          { type: 'uint256', value: chainId },
          { type: 'address', value: to },
          { type: 'uint256', value: value },
          { type: 'bytes', value: data },
          { type: 'uint256', value: txGas },
          { type: 'uint256', value: nonce },
        ]
      default:
        throw { message: `Unknown method: ${method}` }
    }
  }
}
