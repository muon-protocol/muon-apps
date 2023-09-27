const {Web3} = MuonAppUtils

const web3 = new Web3();

function verifySignedMessage(message, signature, expectedAddress) {
  const recoveredAddress = web3.eth.accounts.recover(message, signature);
  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}

const MannaApp = {
  APP_NAME: 'manna',
  useTss: true,

  onRequest: async function (request) {
    let {method, data: {params = {}}} = request;
    let {signature, timestamp, address} = params;
    switch (method) {
      case 'checkins':
        if (!verifySignedMessage(timestamp.toString(), signature, address))
          throw {message: "invalid signature"}

        const timeNow = Date.now() / 1000;
        if (timeNow > timestamp + (60 * 5) || timestamp > timeNow)
          throw {message: "invalid timestamp"}

        return {timestamp, address};

      case 'test':
        return {test: "OK"};

      case 'gitcoinScore':
        let score = 30;
        return {score, timestamp, address};

      default:
        throw {message: `invalid method ${method}`}
    }
  },

  signParams: function (request, result) {
    let {timestamp, address, test, score} = result;
    switch (request.method) {
      case 'checkins':
        return [
          {type: 'uint256', value: timestamp},
          {type: 'address', value: address}
        ];

      case 'test':
        return [
          {type: 'string', value: test}
        ];

      case 'gitcoinScore':
        return [
          {type: 'uint256', value: score},
          {type: 'uint256', value: timestamp},
          {type: 'address', value: address}
        ];

      default:
        throw {message: `Unknown method: ${request.method}`}
    }
  }
}

module.exports = MannaApp;
