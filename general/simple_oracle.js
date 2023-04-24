const { axios } = MuonAppUtils

module.exports = {
  APP_NAME: 'simple_oracle',

  onRequest: async function(request){
    let {
      method,
      data: { params }
    } = request
    switch (method) {
      case 'eth-price':
        const response = await axios
          .get('https://api.coinbase.com/v2/exchange-rates?currency=ETH')
        const price = parseInt(response.data.data.rates.USD)
        return { price }
      case 'price':
        let { token, unit } = params
        const response = await axios.get(`https://api.coinbase.com/v2/exchange-rates?currency=${token}`)
        const price = parseInt(response.data.data.rates[unit])
        return { price }

      default:
        throw `Unknown method ${method}`
    }
  },

  signParams: function(request, result){
    let {
      method,
      data: { params }
    } = request
    let { price } = result;
    let { token, unit } = params

    switch (method) {
      case 'eth-price':
        return [
          { type: 'uint32', value: price }
        ]
      case 'price':
        return [
          { type: 'uint32', value: price },
          { type: 'string', value: token },
          { type: 'string', value: unit },
        ]

      default:
        throw `Unknown method '${method}'`
    }
  }
}

