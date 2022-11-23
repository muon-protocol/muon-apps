const { axios, soliditySha3 } = MuonAppUtils

module.exports = {
  APP_NAME: 'simple_oracle',

  onRequest: async function(request){
    let { method } = request
    switch (method) {
      case 'eth-price':
        const data = await axios.get('https://api.coinbase.com/v2/exchange-rates?currency=ETH')
        return {
          price: data['rates']['USD'],
        }

      default:
        throw { message: `Unknown method ${method}` }
    }
  },

  signParams: function(request, result){
    let { method } = request;
    let { price } = result;
    switch (method) {
      case 'test':
        return [
          { type: 'uint256', value: price }
        ]
      default:
        break
    }
  }
}

