const { axios, muonSha3 } = MuonAppUtils

const LOCK_DURATION = 24 * 60 * 60;

const EXPLORER_API = {
  // PION explorer api endpoint
  2: "https://explorer.muon.net/pion/api/v1/requests",
  // ALICE explorer api endpoint
  3: "https://explorer.muon.net/alice/api/v1/requests",
  // local devnet explorer api endpoint
  255: "http://localhost:8004/api/v1/requests",
}

async function fetchRequest(networkId, requestId) {
  const apiEndpoint = EXPLORER_API[networkId];
  if(!apiEndpoint)
    throw `Explorer api endpoint not found for network: ${networkId}.`;
  return axios.get(`${apiEndpoint}/${requestId}`)
    .then(({data}) => data?.request)
    .catch(e => undefined);
}

const DeRandApp = {
  APP_NAME: "derand_offchain_vrf",

  hashParams: function(request) {
    let {
      randomSeed
    } = request.data.params;

    return muonSha3(
      { type: "string", value: randomSeed }
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
      randomSeed
    } = request.data.params

    if (!randomSeed) throw { message: 'Invalid randomSeed' }

    return {
      randomSeed: randomSeed.toString()
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
          randomSeed
        } = result;

        return [
          { type: "string", value: randomSeed },
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