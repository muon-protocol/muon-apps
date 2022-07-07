const { ethCall, soliditySha3 } = MuonAppUtils

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
      { internalType: 'bool', name: 'transferParams', type: 'bool' },
      { internalType: 'uint256[]', name: 'nftId', type: 'uint256[]' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

const ABI_encodeParams = [{
      inputs: [
        {
          "internalType": "uint256[]",
          "name": "ids",
          "type": "uint256[]"
        }
      ],
      name: "encodeParams",
      outputs: [
        {
          "internalType": "bytes",
          "name": "",
          "type": "bytes"
        }
      ],
      stateMutability: "view",
      type: "function"
    }]


const ABI_claimFor = [
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'uint256[]', name: 'nftId', type: 'uint256[]' },
      { internalType: 'bytes', name: 'nftParams', type: 'bytes' },
      { internalType: 'uint256[4]', name: 'txParams', type: 'uint256[4]' },
      { internalType: 'bytes', name: '_reqId', type: 'bytes' },
      {
        components: [
          { internalType: 'uint256', name: 'signature', type: 'uint256' },
          { internalType: 'address', name: 'owner', type: 'address' },
          { internalType: 'address', name: 'nonce', type: 'address' },
        ],
        internalType: 'struct IMuonV02.SchnorrSign[]',
        name: '_sigs',
        type: 'tuple[]',
      }
    ],
    name: 'claimFor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  }
]

const ChainMap = {
  ETH: 1,
  RINKEBY: 4,
  BSC: 56,
  BSC_TESTNET: 97,
  MATIC: 137,
  MATIC_TESTNET: 80001,
}

const BRIDGE_ADDRESSES = {
  [ChainMap.ETH]: "0x77C7f8D5a7B04c9b5f5614027026D5B68e0DbB86",
  [ChainMap.MATIC]: "0x77C7f8D5a7B04c9b5f5614027026D5B68e0DbB86",
  [ChainMap.BSC]: "0x77C7f8D5a7B04c9b5f5614027026D5B68e0DbB86",
  [ChainMap.RINKEBY]: "0x261919DCA6F759aE4c791f9f49935C7Fe184aCdA",
  [ChainMap.MATIC_TESTNET]: "0xcFBA218b19F766026f111CEf6b7fC4Dff9126059",
  [ChainMap.BSC_TESTNET]: "0x7d1A0aB943eaC4af5DeA19628696B3cD1D6a4703",
}

module.exports = {
  APP_NAME: 'mrc721_bridge',
  APP_ID: 10,

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request
    switch (method) {
      case 'claim':
        let { depositAddress, depositTxId, depositNetwork } = params
        //TODO: check chain
        if (!depositAddress) throw { message: 'Invalid contarct address' }
        if (!depositTxId) throw { message: 'Invalid deposit Tx Id' }
        if (!depositNetwork) throw { message: 'Invalid deposit Network' }
        let result = await ethCall(
          depositAddress,
          'getTx',
          [depositTxId],
          ABI_getTx,
          depositNetwork
        )
        result.nftParams = result.transferParams ? (
          await ethCall(
            result.nftContract,
            "encodeParams",
            [result.nftId],
            ABI_encodeParams,
            depositNetwork
          )
        ): "";

        result.keeper_params = {
          abi: ABI_claimFor,
          contract: BRIDGE_ADDRESSES[result.toChain],
          method: "claimFor",
          methodParams: [
            result.user,
            result.nftId,
            result.nftParams?result.nftParams:'0x',
            [
              result.fromChain,
              result.toChain,
              result.tokenId,
              result.txId
            ]
          ]
        }
        
        return result

      default:
        throw { message: `Unknown method ${params}` }
    }
  },

  hashRequestResult: function (request, result) {
    let {
      method,
      data: { params }
    } = request

    switch (method) {
      case 'claim':
        let { depositAddress } = request.data.params

        let { txId, tokenId, fromChain, toChain, user, nftId, nftParams } = result

        return soliditySha3([
          { type: 'uint32', value: this.APP_ID },
          { type: 'uint256', value: txId },
          { type: 'uint256', value: tokenId },
          { type: 'uint256', value: fromChain },
          { type: 'uint256', value: toChain },
          { type: 'address', value: user },
          { type: 'uint256[]', value: nftId },
          { type: 'bytes', value: nftParams }
        ])

      default:
        return null
    }
  }
}
