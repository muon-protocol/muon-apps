const { axios, muonSha3, ethGetTransactionReceipt, ethGetWeb3 } = MuonAppUtils

const LOCK_DURATION = 24 * 60 * 60;

const EXPLORER_API = {
  // PION explorer api endpoint
  2: "https://explorer.muon.net/pion/api/v1/requests",
  // ALICE explorer api endpoint
  3: "https://explorer.muon.net/alice/api/v1/requests",
  // local devnet explorer api endpoint
  255: "http://localhost:8004/api/v1/requests",
}

const RANDOM_WORDS_REQUESTED_ABI = [
  {
    "indexed": false,
    "name": "requestId",
    "type": "uint256"
  },
  {
    "indexed": false,
    "name": "preSeed",
    "type": "uint256"
  },
  {
    "indexed": false,
    "name": "minimumRequestConfirmations",
    "type": "uint16"
  },
  {
    "indexed": false,
    "name": "callbackGasLimit",
    "type": "uint32"
  },
  {
    "indexed": false,
    "name": "numWords",
    "type": "uint32"
  },
  {
    "indexed": true,
    "name": "sender",
    "type": "address"
  }
]

async function fetchRequest(networkId, requestId) {
  const apiEndpoint = EXPLORER_API[networkId];
  if(!apiEndpoint)
    throw `Explorer api endpoint not found for network: ${networkId}.`;
  return axios.get(`${apiEndpoint}/${requestId}`)
    .then(({data}) => data?.request)
    .catch(e => undefined);
}

const DeRandApp = {
  APP_NAME: "derand",

  hashParams: function(request) {
    let {
      chainId,
      txHash
    } = request.data.params;

    return muonSha3(
      { type: "uint256", value: chainId },
      { type: "bytes", value: txHash }
    );
  },

  onArrive: async function (request) {
    let {
      method,
      deploymentSeed,
    } = request;

    switch (method) {
      case "random-number": {
        const paramsHash = this.hashParams(request)
        let memory = await this.readGlobalMem(`derand-lock-${paramsHash}`);
        if (memory) {
          throw { message: `The random already generated and locked for a while.` };
        }

        const result = await this.randomNumberResult(request)
        const reqId = this.calculateRequestId(request, result);
        await this.writeGlobalMem(`derand-lock-${paramsHash}`, JSON.stringify({seed: deploymentSeed, reqId}), LOCK_DURATION);
      }
    }
  },

  randomNumberResult: async function (request) {
    let {
      chainId,
      txHash
    } = request.data.params

    if (!chainId) throw { message: 'Invalid chainId' }
    if (!txHash) throw { message: 'Invalid txHash' }

    onchainParams = await Promise.all(
      [
        ethGetTransactionReceipt(txHash, chainId),
        ethGetWeb3(chainId)
      ]
    );

    let { blockNumber: blockNum, logs } = onchainParams[0];

    let web3 = onchainParams[1]

    let {
      requestId,
      callbackGasLimit,
      numWords,
      sender: consumer,
    } = web3.eth.abi.decodeLog(
      RANDOM_WORDS_REQUESTED_ABI, 
      logs[0].data, 
      logs[0].topics
    );

    return {
      chainId: chainId.toString(),
      coordinatorAddress: logs[0].address,
      requestId: requestId.toString(),
      blockNum: blockNum.toString(),
      callbackGasLimit: callbackGasLimit.toString(),
      numWords: numWords.toString(),
      consumer,
    }
  },

  onRequest: async function (request) {
    let {
      method,
      deploymentSeed,
      gwAddress,
      data: { params },
    } = request;
    switch (method) {
      case "random-number": {
        const paramsHash = this.hashParams(request)
        const memory = await this.readGlobalMem(`derand-lock-${paramsHash}`)
        if(!memory)
          throw `Global lock not performed`

        const memData = JSON.parse(memory.value);
        const result = await this.randomNumberResult(request);
        const reqId = this.calculateRequestId(request, result);

        if(memory.owner !== gwAddress || memData.seed !== deploymentSeed && memData.reqId !== reqId) {
          throw { 
            message: `Error when checking lock`,
            memory: memData,
            gwAddress,
            deploymentSeed,
          }
        }

        await this.writeLocalMem(`derand-lock-${paramsHash}`, "locked", LOCK_DURATION, {preventRewrite: true})

        return result;
      }
      case "delete-global-memory": {
        const paramsHash = this.hashParams(request)
        const lockKey = `derand-lock-${paramsHash}`
        let memory = await this.readGlobalMem(lockKey);
        if (!memory) {
          throw { message: `Lock not found.` };
        }
        const memData = JSON.parse(memory.value);
        let req2 = await fetchRequest(this.netConfigs.networkId, memData.reqId);
        if(req2)
          throw `Lock is successfully done for the request ${memData.reqId}`;
        return {
          key: lockKey,
          message: `delete global memory ${lockKey}`
        }
      }

      default:
        throw { message: `invalid method ${method}` };
    }
  },

  signParams: function (request, result) {
    switch (request.method) {
      case "random-number": {
        let {
          chainId,
          coordinatorAddress,
          requestId,
          blockNum,
          callbackGasLimit,
          numWords,
          consumer,
        } = result;

        return [
          { type: "uint256", value: chainId },
          { type: "address", value: coordinatorAddress },
          { type: "uint256", value: requestId },
          { type: "uint256", value: blockNum },
          { type: "uint32", value: callbackGasLimit },
          { type: "uint32", value: numWords },
          { type: "address", value: consumer },
        ];
      }
      case "delete-global-memory": {
        const { key, message } = result;
        return [key, " ", message]
      }

      default:
        throw { message: `Unknown method: ${request.method}` };
    }
  },

  onConfirm: async function(request, result, signatures) {
    switch(request.method) {
      case "delete-global-memory": {
        let { key } = result;
        await this.deleteGlobalMem(key, request)
        await this.deleteLocalMem(key)
      }
    }
  }
};

module.exports = DeRandApp;