// require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
// require('../../core/global')

require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../src/core/global')
// const { onRequest } = require('../general/muon_pvrb');

const { dynamicExtend } = require('../../src/core/utils')
const AggregateOracles = dynamicExtend(
  class {},
  require('../general/aggregate_oracles_dei')
)

const app = new AggregateOracles()

const testPrice = async (tokenName) => {
  let method = 'price'

  return app
    .onRequest({
      method,
      data: {}
    })
    .then(({ tokenPrice, volume }) => {
      console.log(`\n \nResult for PRICE ${tokenName}`)
      console.log({ tokenPrice, volume })
    })
    .catch((error) => console.log(error))
}

testPrice('DEI')
