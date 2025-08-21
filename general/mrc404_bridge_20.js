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
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: "bytes", name: "nftData", type: "bytes" }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

const BRIDGE_ADDRESSES = {
  // sepolia: "0x90FeC556De8caf34E2f4c655a954e4C6Dc0F1b22",
  // mumbai: "0xD66bbf580248f72039F5a48231F8C3aD20335B4E",
  bsc: "0xC4A08fAf00dA2843373851CD1031169B4eDfFF6a",
  blast: "0xC4A08fAf00dA2843373851CD1031169B4eDfFF6a",
  base: "0xC4A08fAf00dA2843373851CD1031169B4eDfFF6a",
  arbitrum: "0xC4A08fAf00dA2843373851CD1031169B4eDfFF6a",
  optimism: "0xC4A08fAf00dA2843373851CD1031169B4eDfFF6a"
}

module.exports = {
  APP_NAME: 'mrc404_bridge_20',

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
        let { txId, tokenId, amount, fromChain, toChain, user, nftData } = result
        if(!tokenId){
          throw {message: "Invalid tx"}
        }
        return {
          txId: txId.toString(),
          tokenId: tokenId.toString(),
          amount: amount.toString(),
          fromChain: fromChain.toString(),
          toChain: toChain.toString(),
          user,
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
        let { txId, tokenId, amount, fromChain, toChain, user, nftData } = result

        return [
          { type: 'uint256', value: txId },
          { type: 'uint256', value: tokenId },
          { type: 'uint256', value: amount },
          { type: 'uint256', value: fromChain },
          { type: 'uint256', value: toChain },
          { type: 'address', value: user },
          { type: 'bytes', value: nftData },
        ]
      case 'test':
        return [{type: 'string', value: result.toString()}]
      default:
        throw { message: `Unknown method: ${method}` }
    }
  }
}
