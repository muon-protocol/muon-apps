const { axios, soliditySha3, floatToBN } = MuonAppUtils

function getPrice() {
  return axios
    .get(
      'https://api.fear.io/api/cp'
    )
    .then(({ data }) => data)
    .catch((err) => {
      return err?.response?.data
    })
}

module.exports = {
  APP_NAME: 'fear_price',

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request;
    switch (method) {
      case 'get_price':
        let result = await getPrice();

        if (!result || result == 0) {
          throw { message: 'invalid price' }
        }

        return {
          price: floatToBN(result, 18).toString()
        }

      default:
        throw { message: `Unknown method ${params}` }
    }
  },

  hashRequestResult: function (request, result) {
    let { method } = request
    switch (method) {
      case 'get_price':
        let { price } = result
        return soliditySha3([
          { type: 'uint256', value: this.APP_ID },
          { type: 'uint256', value: request.data.result.price },
          { type: 'uint256', value: request.data.timestamp}
        ])

      default:
        break
    }
  }
}
