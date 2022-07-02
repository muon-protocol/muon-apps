require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../core/global')
const { dynamicExtend } = require('../../core/utils')
const Oracles = dynamicExtend(
  class {},
  require('../general/permissionless_oracles_vwap_v3')
)

const app = new Oracles()

const testLP = async (params, token, tokenName) => {
  let method = 'lp_price'

  return app
    .onRequest({
      method,
      data: {
        params
      }
    })
    .then(({ tokenPrice, volume }) => {
      console.log(`\n \nResult for LP_PRICE ${tokenName}: ${token}`)
      console.log({ tokenPrice, volume })
    })
    .catch((error) => console.log(error))
}

const testPrice = async (params, token, tokenName) => {
  let method = 'price'

  return app
    .onRequest({
      method,
      data: {
        params
      }
    })
    .then(({ tokenPrice, volume }) => {
      console.log(`\n \nResult for PRICE ${tokenName}: ${token}`)
      console.log({ tokenPrice, volume })
    })
    .catch((error) => console.log(error))
}

const tokenNameLP = 'vAMM-DEI/DEUS'
const tokenLP = '0xF42dBcf004a93ae6D5922282B304E2aEFDd50058' // vAMM-DEI/DEUS
const LP_Params = {
  token: tokenLP,
  chainId: '250',
  pairs0: [
    {
      exchange: 'solidly',
      chainId: '250',
      address: '0x5821573d8F04947952e76d94f3ABC6d7b43bF8d0' // DEI-USDC
    }
  ],
  pairs1: [
    {
      exchange: 'solidly',
      chainId: '250',
      address: '0xF42dBcf004a93ae6D5922282B304E2aEFDd50058' //DEI - DEUS
    },
    {
      exchange: 'spirit',
      chainId: '250',
      address: '0x8eFD36aA4Afa9F4E157bec759F1744A7FeBaEA0e' //DEI - USDC
    }
  ]
}
const tokenNameLP2 = 'vAMM-DEI/DEUS'
const tokenLP2 = '0xF42dBcf004a93ae6D5922282B304E2aEFDd50058' // vAMM-DEI/DEUS
const LP_Params2 = {
  token: tokenLP2,
  chainId: '250',
  pairs0: [
    {
      exchange: 'solidly',
      chainId: '250',
      address: '0x5821573d8F04947952e76d94f3ABC6d7b43bF8d0' // DEI-USDC
    }
  ],
  pairs1: [
    {
      exchange: 'spirit',
      chainId: '250',
      address: '0xdDC92fcEd95e913728CBc8f197A4E058062Bd4b6' //DEI-DEUS
    },
    {
      exchange: 'solidly',
      chainId: '250',
      address: '0x5821573d8F04947952e76d94f3ABC6d7b43bF8d0' // DEI-USDC
    }
  ]
}

const tokenName = 'DEUS'
const token = '0xDE5ed76E7c05eC5e4572CfC88d1ACEA165109E44' // token:deus
const params = {
  token,
  pairs: [
    {
      exchange: 'solidly',
      chainId: '250',
      address: '0xF42dBcf004a93ae6D5922282B304E2aEFDd50058' // DEI/DEUS
    },
    {
      exchange: 'spirit',
      chainId: '250',
      address: '0x8eFD36aA4Afa9F4E157bec759F1744A7FeBaEA0e' // DEI/USDC
    }
  ]
}

const tokenName2 = 'Wrapped Fantom (WFTM)'
const token2 = '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83'
const params2 = {
  token: token2,
  pairs: [
    {
      exchange: 'spooky',
      chainId: '250',
      address: '0x2b4C76d0dc16BE1C31D4C1DC53bF9B45987Fc75c'
    }
  ]
}

const tokenName3 = 'Wrapped Ether (WETH)'
const token3 = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const params3 = {
  token: token3,
  pairs: [
    {
      exchange: 'uniswap',
      chainId: '1',
      address: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'
    }
  ]
}

const tokenName4 = 'Wrapped Ether (WETH)'
const token4 = '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83'
const params4 = {
  token: token4,
  pairs: [
    {
      exchange: 'spooky',
      chainId: '250',
      address: '0x2b4C76d0dc16BE1C31D4C1DC53bF9B45987Fc75c'
    }
  ]
}

const tokenNameLP3 = 'Spooky LP'
const tokenLP3 = '0x2b4C76d0dc16BE1C31D4C1DC53bF9B45987Fc75c'
const LP_Params3 = {
  token: tokenLP3,
  chainId: 250,
  pairs0: [],
  pairs1: [
    {
      exchange: 'spooky',
      chainId: '250',
      address: '0x2b4C76d0dc16BE1C31D4C1DC53bF9B45987Fc75c'
    }
  ]
}

const tokenNameLP4 = 'SushiSwap LP Token (SLP)'
const tokenLP4 = '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0'
const LP_Params4 = {
  token: tokenLP4,
  pairs0: [],
  pairs1: [
    {
      exchange: 'sushi',
      chainId: 1,
      address: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0'
    }
  ],
  chainId: 1
}

const tokenNameLP5 = 'Uniswap V2 (UNI-V2)'
const tokenLP5 = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'
const LP_Params5 = {
  token: tokenLP5,
  chainId: 1,
  pairs0: [],
  pairs1: [
    {
      exchange: 'uniswap',
      chainId: '1',
      address: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'
    }
  ]
}

const tokenName5 = 'Wrapped Ether (WETH)'
const token5 = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const params5 = {
  token: token5,
  pairs: [
    {
      exchange: 'sushi',
      chainId: 1,
      address: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0'
    }
  ]
}
testLP(LP_Params, tokenLP, tokenNameLP)
testLP(LP_Params2, tokenLP2, tokenNameLP2)
testLP(LP_Params3, tokenLP3, tokenNameLP3)
testLP(LP_Params4, tokenLP4, tokenNameLP4)
testLP(LP_Params5, tokenLP5, tokenNameLP5)

testPrice(params, token, tokenName)
testPrice(params2, token2, tokenName2)
testPrice(params3, token3, tokenName3)
testPrice(params4, token4, tokenName4)
testPrice(params5, token5, tokenName5)
