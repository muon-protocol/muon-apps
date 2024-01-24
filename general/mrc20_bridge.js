const { ethCall } = MuonAppUtils

const ABI_getTx = [
  {
    inputs: [{ internalType: 'uint256', name: '_txId', type: 'uint256' }],
    name: 'getTx',
    outputs: [
      { internalType: 'uint256', name: 'txId', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'fromChain', type: 'uint256' },
      { internalType: 'uint256', name: 'toChain', type: 'uint256' },
      { internalType: 'address', name: 'user', type: 'address' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

module.exports = {
  APP_NAME: 'mrc20_bridge',

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request

    switch (method) {
      case 'claim':
        let { depositAddress, depositTxId, depositNetwork = 'eth' } = params
        if (!depositAddress) throw { message: 'Invalid contarct address' }
        if (!depositTxId) throw { message: 'Invalid deposit Tx Id' }

        let result = await ethCall(
          depositAddress,
          'getTx',
          [depositTxId],
          ABI_getTx,
          depositNetwork
        )
        return result
      case 'test':
          return 'done';
      default:
        throw { message: `Unknown method ${method}` }
    }
  },

  signParams: function (request, result) {
    let { method } = request

    switch (method) {
      case 'claim':
        let { txId, tokenId, amount, fromChain, toChain, user } = result

        return [
          { type: 'uint256', value: txId },
          { type: 'uint256', value: tokenId },
          { type: 'uint256', value: amount },
          { type: 'uint256', value: fromChain },
          { type: 'uint256', value: toChain },
          { type: 'address', value: user }
        ]
      case 'test':
        return [{type: 'string', value: result.toString()}]
      default:
        throw { message: `Unknown method: ${method}` }
    }
  }
}
