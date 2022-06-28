const { soliditySha3, ethCall, ethGetTokenInfo, ethHashCallOutput } =
  MuonAppUtils

const MuonBridge = {
  3: '0x54b33C420dC1430e3200004529c45AEdbDe17a40',
  4: '0x68F9191Fe8853eb5662466F270869EAf297596a9',
  97: '0xfAB83A73BEb73c2a6AEcB2D94593C58C893771b6',
  80001: '0xE607AEF8Ebe06fC81Aad55311eD6d540d5906366'
}
const ABI_getTx = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_txId',
        type: 'uint256'
      }
    ],
    name: 'getTx',
    outputs: [
      {
        internalType: 'uint256',
        name: 'txId',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'fromChain',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'toChain',
        type: 'uint256'
      },
      {
        internalType: 'address',
        name: 'user',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

const ABI_getTokenId = [
  {
    inputs: [{ internalType: 'address', name: '_addr', type: 'address' }],
    name: 'getTokenId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
]

module.exports = {
  APP_NAME: 'bridge',
  APP_ID: 3,

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request
    switch (method) {
      case 'claim': {
        let { depositAddress, depositTxId, depositNetwork = 'eth' } = params

        if (!depositAddress) throw { message: 'Invalid contract "address"' }
        if (!depositTxId) throw { message: 'Invalid depositTxId' }

        let result = await ethCall(
          depositAddress,
          'getTx',
          [depositTxId],
          ABI_getTx,
          depositNetwork
        )
        return result
      }
      case 'addBridgeToken': {
        let { mainTokenAddress, mainNetwork } = params
        let [currentId, token] = await Promise.all([
          await ethCall(
            MuonBridge[mainNetwork],
            'getTokenId',
            [mainTokenAddress],
            ABI_getTokenId,
            mainNetwork
          ),
          await ethGetTokenInfo(mainTokenAddress, mainNetwork)
        ])

        // let sourceChain = await findSourceChain(mainTokenAddress, mainNetwork)

        let result = {
          token: {
            symbol: token.symbol.replace('μ-', ''),
            name: token.name.replace('Muon ', ''),
            decimals: token.decimals
          },
          tokenId: currentId == 0 ? mainTokenAddress : currentId
          // sourceChain
        }
        return result
      }

      default:
        throw { message: `Unknown method ${method}` }
    }
  },

  hashRequestResult: function (request, result) {
    switch (request.method) {
      case 'claim': {
        let { depositAddress } = request.data.params
        let { txId, tokenId, amount, fromChain, toChain, user } = result

        return soliditySha3([
          { type: 'uint8', value: this.APP_ID },
          { type: 'address', value: depositAddress },
          { type: 'uint256', value: txId },
          { type: 'uint256', value: tokenId },
          { type: 'uint256', value: amount },
          { type: 'uint256', value: fromChain },
          { type: 'uint256', value: toChain },
          { type: 'address', value: user }
        ])
      }
      case 'addBridgeToken': {
        let { token, tokenId } = result
        return soliditySha3([
          { type: 'uint8', value: this.APP_ID },
          { type: 'uint256', value: tokenId },
          { type: 'string', value: token.name },
          { type: 'string', value: token.symbol },
          { type: 'uint8', value: token.decimals }
        ])
      }
      default:
        return null
    }
  }
}
