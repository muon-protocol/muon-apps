const {Web3, axios} = MuonAppUtils

const web3 = new Web3();

function verifySignedMessage(message, signature, expectedAddress) {
  const recoveredAddress = web3.eth.accounts.recover(message, signature);
  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}

const scorer_id = process.env.SCORER_ID;
const api_key = process.env.API_KEY;
const scorer_url = "https://api.scorer.gitcoin.co/registry/submit-passport"

const MannaApp = {
  APP_NAME: 'manna',
  useTss: true,

  onRequest: async function (request) {
    let {method, data: {params = {}}} = request;
    let {signature, timestamp, address} = params;

    const timeNow = Date.now() / 1000;
    if (timeNow > timestamp + (60 * 3) || timestamp > timeNow)
      throw {message: "invalid timestamp"}

    switch (method) {
      case 'checkIn':
        if (!verifySignedMessage(timestamp.toString(), signature, address))
          throw {message: "invalid signature"}
        return {timestamp, address};

      case 'gitcoinScore':
        const config = {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': api_key
          }
        };
        const params = {
          'address': address,
          'scorer_id': scorer_id
        };
        const data = (await axios.post(scorer_url, params, config)).data;
        if (data.score == null)
          throw {message: "We have relieved rate limit error from gitcoin. Please try again later"}
        let score = Math.floor(data.score * 10 ** 6);
        return {score, timestamp, address};

      case 'test':
        return {test: "OK"};

      default:
        throw {message: `invalid method ${method}`}
    }
  },

  signParams: function (request, result) {
    let {timestamp, address, test, score} = result;
    switch (request.method) {
      case 'checkIn':
        return [
          {type: 'uint256', value: timestamp},
          {type: 'address', value: address}
        ];

      case 'gitcoinScore':
        return [
          {type: 'uint256', value: score},
          {type: 'uint256', value: timestamp},
          {type: 'address', value: address}
        ];

      case 'test':
        return [
          {type: 'string', value: test}
        ];

      default:
        throw {message: `Unknown method: ${request.method}`}
    }
  }
}

module.exports = MannaApp;
