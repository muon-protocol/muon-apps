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

const BRIDGE_ADDRESSES = {
  sepolia: "0x67734b805360A385f8f5c0F3fb354AE1E445db75",
  bsctest: "0x50cbA2d42042E8347bc8d91A4f45170151dCf6Df",
}

module.exports = {
  APP_NAME: 'carrier3_bridge',

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request

    switch (method) {
      case 'claim':
        let { depositTxId, depositNetwork = 'eth' } = params
        if (!(depositNetwork in BRIDGE_ADDRESSES)) {
          throw { message: 'Invalid deposit network' }
        }
        if (!depositTxId) throw { message: 'Invalid deposit Tx Id' }

        const depositAddress = BRIDGE_ADDRESSES[depositNetwork]

        let result = await ethCall(
          depositAddress,
          'getTx',
          [depositTxId],
          ABI_getTx,
          depositNetwork
        )
        let { txId, tokenId, amount, fromChain, toChain, user } = result
        return {
          txId: txId.toString(),
          tokenId: tokenId.toString(),
          amount: amount.toString(),
          fromChain: fromChain.toString(),
          toChain: toChain.toString(),
          user
        }
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
