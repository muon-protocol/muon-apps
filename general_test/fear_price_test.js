require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../src/core/global')
const { onRequest } = require('../general/fear_price');


const testGetPrice = async () => {
  let method = 'get_price'

  return onRequest({
      method,
      data: {}
    })
    .then((x) => {
      console.log(x)
    })
    .catch((error) => console.log(error))
}

testGetPrice()

