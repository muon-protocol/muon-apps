require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../src/core/global')
const { onRequest } = require('../general/muon_v3_sample');

const test= async () => {
  return onRequest({
    method:'test',
    data: {
    }
  }).then((response) => {
      console.log(response);
    })
    .catch((error) => console.log(error))
}

test()
