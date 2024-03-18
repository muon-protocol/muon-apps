const { ethCall } = MuonAppUtils

const ABI_getTx = [
  {
    inputs: [{ internalType: 'uint256', name: '_txId', type: 'uint256' }],
    name: 'getTx',
    outputs: [
      { internalType: 'uint256', name: 'txId', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'fromChain', type: 'uint256' },
      { internalType: 'uint256', name: 'toChain', type: 'uint256' },
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'address', name: 'nftContract', type: 'address' },
      { internalType: "uint256[]", name: "nftIds", type: "uint256[]" },
      { internalType: "bytes", name: "nftData", type: "bytes" }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

const BRIDGE_ADDRESSES = {
  sepolia: "0xE166A32d179a361c1017f8efFEe22bacAe6160FC",
  mumbai: "0xC200536beD0dDD8d13eA7C8Eabda762f33028FB0"
}

module.exports = {
  APP_NAME: 'mrc404_bridge_721',

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
        let { txId, tokenId, fromChain, toChain, user, nftIds, nftData } = result
        nftIds = nftIds.map((val) => val.toString());
        return {
          txId: txId.toString(),
          tokenId: tokenId.toString(),
          fromChain: fromChain.toString(),
          toChain: toChain.toString(),
          user,
          nftIds,
          nftData
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
        let { txId, tokenId, fromChain, toChain, user, nftIds, nftData } = result

        return [
          { type: 'uint256', value: txId },
          { type: 'uint256', value: tokenId },
          { type: 'uint256', value: fromChain },
          { type: 'uint256', value: toChain },
          { type: 'address', value: user },
          { type: 'uint256[]', value: nftIds },
          { type: 'bytes', value: nftData },
        ]
      case 'test':
        return [{type: 'string', value: result.toString()}]
      default:
        throw { message: `Unknown method: ${method}` }
    }
  }
}
