const {Web3} = MuonAppUtils

const web3 = new Web3();

function verifySignedMessage(message, signature, expectedAddress) {
  const recoveredAddress = web3.eth.accounts.recover(message, signature);
  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}

const scorer_id = process.env.SCORER_ID;
const api_key = process.env.API_KEY;

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
        const data = await (await fetch('https://api.scorer.gitcoin.co/registry/submit-passport', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': api_key
          },
          body: JSON.stringify({
            'address': address,
            'scorer_id': scorer_id
          })
        })).json();
        if (data.score == null)
          throw `rate limited!`;
        let score = Math.floor(data.score * 10 ** 6);
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
