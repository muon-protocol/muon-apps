const { axios } = MuonAppUtils

module.exports = {
  APP_NAME: 'simple_oracle',

  onRequest: async function(request){
    let { method } = request
    switch (method) {
      case 'eth-price':
        const response = await axios
          .get('https://api.coinbase.com/v2/exchange-rates?currency=ETH')
        const price = parseInt(response.data.data.rates.USD)
        return { price }

      default:
        throw `Unknown method ${method}`
    }
  },

  signParams: function(request, result){
    let { method } = request;
    let { price } = result;
    switch (method) {
      case 'eth-price':
        return [
          { type: 'uint32', value: price }
        ]

      default:
        throw `Unknown method '${method}'`
    }
  }
}

