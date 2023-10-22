const {Web3, axios} = MuonAppUtils

const web3 = new Web3();

function verifySignedMessage(message, signature, expectedAddress) {
  const recoveredAddress = web3.eth.accounts.recover(message, signature);
  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}

const scorerId = process.env.SCORER_ID;
const apiKey = process.env.API_KEY;
const scorerUrl = "https://api.scorer.gitcoin.co/registry/submit-passport"
const checkInMessagePrefix = "Check-in timestamp: "
const gitcoinPassportMessagePrefix = "Verification request timestamp: "
const redisPrefix = "manna-gitcoin-score-"

const MannaApp = {
  APP_NAME: 'manna',
  dependencies: ['redis'],
  useTss: true,

  onRequest: async function (request) {
    let {method, data: {params = {}}} = request;
    let {signature, timestamp, address} = params;

    const timeNow = Math.floor(Date.now() / 1000);
    if (timeNow > timestamp + (60 * 3) || timestamp > timeNow)
      throw {message: "invalid timestamp"}

    switch (method) {
      case 'checkIn':
        if (!verifySignedMessage(checkInMessagePrefix + timestamp.toString(), signature, address))
          throw {message: "invalid signature"}
        return {timestamp, address};

      case 'gitcoinScore':
        if (!verifySignedMessage(gitcoinPassportMessagePrefix + timestamp.toString(), signature, address))
          throw {message: "invalid signature"}
        let cache = await this.redis.get(redisPrefix + address);
        if (cache != null) {
          let hitCache = JSON.parse(cache);
          if (timeNow <= hitCache.timestamp + (60 * 15)) {
            const score = hitCache.score;
            return {score, timestamp, address};
          }
        }
        const config = {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey
          }
        };
        const params = {
          'address': address,
          'scorer_id': scorerId
        };
        const data = (await axios.post(scorerUrl, params, config)).data;
        if (data.score == null)
          throw {message: "We have relieved rate limit error from gitcoin. Please try again later"}
        let score = Math.floor(data.score * 10 ** 6);
        await this.redis.set(redisPrefix + address, JSON.stringify({timestamp: timeNow, score: score}));
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
