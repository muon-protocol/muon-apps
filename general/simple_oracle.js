const { axios, floatToBN } = MuonAppUtils

module.exports = {
  APP_NAME: 'simple_oracle',

  onRequest: async function(request){
    let { method } = request
    switch (method) {
      case 'eth-price':
        const response = await axios
          .get('https://api.coinbase.com/v2/exchange-rates?currency=ETH')
          .then(({data}) => data)
        if(!response?.data?.rates?.USD)
          throw `USD rate not found`
        return {
          price: response.data.rates.USD,
        }

      default:
        throw { message: `Unknown method ${method}` }
    }
  },

  signParams: function(request, result){
    let { method } = request;
    let { price } = result;
    switch (method) {
      case 'eth-price':
        return [
          { type: 'uint256', value: String(floatToBN(price, 18)) }
        ]

      default:
        throw `Unknown method '${method}'`
    }
  }
}


