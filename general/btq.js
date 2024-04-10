const falcon = require('@btq-js/falcon-js');

const BTQApp = {
  APP_NAME: 'btq',
  useTss: true,

  onRequest: async function (request) {
    let {method, data: { params }} = request;

    switch (method) {
      case 'verifyFalconSig':
        try {
          const txData = Uint8Array.from(Buffer.from(params.txData));
          const isVerified = await falcon.verify(
            txData,
            Uint8Array.from(params.falconSig),
            Uint8Array.from(params.falconPubKey)
          )
          if(isVerified) {
            return params.txData;
          } else {
            throw new Error('Invalid falcon sig');
          }
        } catch (error) {
          console.log(error)
          throw new Error('Invalid falcon sig');
        }
      default:
        throw {message: `invalid method ${method}`}
    }
  },

  signParams: function (request, result) {
    console.log(result)
    switch (request.method) {
      case 'verifyFalconSig':
        return [{type: 'string', value: result.toString()}]
      default:
        throw { message: `Unknown method: ${request.method}` }
    }
  }
}

module.exports = BTQApp
