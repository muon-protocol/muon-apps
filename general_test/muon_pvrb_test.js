require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../src/core/global')
const { onRequest } = require('../general/muon_pvrb');

const test= async () => {
  return onRequest({
    method:'pvrb',
    data: {
    	params: {
    		message: "hello every body"
    	}
    }
  }).then((response) => {
      console.log(response);
    })
    .catch((error) => console.log(error))
}

test()
