const { ethCall } = MuonAppUtils

const ABI_JOBS = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "jobs",
    outputs: [
      {
        internalType: "address",
        name: "origin",
        type: "address"
      },
      {
        internalType: "uint32",
        name: "srcEid",
        type: "uint32"
      },
      {
        internalType: "uint32",
        name: "dstEid",
        type: "uint32"
      },
      {
        internalType: "bytes",
        name: "packetHeader",
        type: "bytes"
      },
      {
        internalType: "bytes32",
        name: "payloadHash",
        type: "bytes32"
      },
      {
        internalType: "uint64",
        name: "confirmations",
        type: "uint64"
      },
      {
        internalType: "address",
        name: "sender",
        type: "address"
      },
      {
        internalType: "bytes",
        name: "options",
        type: "bytes"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
]

const DVNs = {
  sepolia: "0x5A94Ab1D4dc5A65E94143929d4E89C2FEF3c2fF2",
  bsctest: "0xfb03bFd0B29CF5e11780139A00C23fa1Fe96b07b",
}

module.exports = {
  APP_NAME: 'layerzero_dvn',

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request

    switch (method) {
      case 'verify':
        let { jobId, network } = params
        if (!(network in DVNs)) {
          throw { message: 'Invalid network' }
        }
        if (!jobId) throw { message: 'Invalid jobId' }

        const contractAddress = DVNs[network]

        let result = await ethCall(
          contractAddress,
          'jobs',
          jobId,
          ABI_JOBS,
          network
        )
        let { srcEid, dstEid, packetHeader, payloadHash, confirmations } = result
        return {
          srcEid: srcEid.toString(),
          dstEid: dstEid.toString(),
          jobId: jobId.toString(),
          packetHeader: packetHeader.toString(),
          payloadHash: payloadHash.toString(),
          confirmations: confirmations.toString(),
        }
      default:
        throw { message: `Unknown method ${method}` }
    }
  },

  signParams: function (request, result) {
    let { method } = request

    switch (method) {
      case 'verify':
        let { srcEid, dstEid, jobId, packetHeader, payloadHash, confirmations } = result

        return [
          { type: 'uint32', value: srcEid },
          { type: 'uint32', value: dstEid },
          { type: 'uint256', value: jobId },
          { type: 'bytes', value: packetHeader },
          { type: 'bytes', value: payloadHash },
          { type: 'uint64', value: confirmations },
        ]
      default:
        throw { message: `Unknown method: ${method}` }
    }
  }
}
