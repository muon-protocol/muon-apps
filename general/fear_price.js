const { axios, soliditySha3, floatToBN, BN } = MuonAppUtils

const PRICE_TOLERANCE = '0.05';

async function callAPI(method) {
  return axios
    .get(
      `https://api.fear.io/api/${method}`
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
        let [fearPrice, ethPrice] = await Promise.all([
          callAPI('cpg'),
          callAPI('cpge')
        ]);

        if (!fearPrice || fearPrice == 0 || isNaN(fearPrice)) {
          throw { message: 'invalid fear price' }
        }

        if (!ethPrice || ethPrice == 0 || isNaN(ethPrice)) {
          throw { message: 'invalid eth price' }
        }

        return {
          fearPrice: floatToBN(fearPrice, 18).toString(),
          ethPrice: floatToBN(ethPrice, 18).toString()
        }

      default:
        throw { message: `Unknown method ${params}` }
    }
  },

  hashRequestResult: function (request, result) {
    let { method } = request
    switch (method) {
      case 'get_price':
        let { fearPrice, ethPrice } = result;
        if (
          !this.isPriceToleranceOk(
            fearPrice,
            request.data.result.fearPrice
          )
        ) {
          throw { message: 'fearPrice difference is not acceptable.' }
        }

        if (
          !this.isPriceToleranceOk(
            ethPrice,
            request.data.result.ethPrice
          )
        ) {
          throw { message: 'ethPrice difference is not acceptable.' }
        }

        return soliditySha3([
          { type: 'uint256', value: this.APP_ID },
          { type: 'uint256', value: request.data.result.fearPrice },
          { type: 'uint256', value: request.data.result.ethPrice },
          { type: 'uint256', value: request.data.timestamp}
        ])

      default:
        break
    }
  },

  // price: calculated price on the current node
  // expectedPrice: this price came from the gateway node
  // and the current node wants to sign it
  isPriceToleranceOk: function (price, expectedPrice) {
    let priceDiff = new BN(price).sub(new BN(expectedPrice)).abs()

    if (
      new BN(priceDiff)
        .div(new BN(expectedPrice))
        .gt(floatToBN(PRICE_TOLERANCE, 18))
    ) {
      return false
    }
    return true
  }
}
