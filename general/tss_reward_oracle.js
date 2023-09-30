const { axios, Web3, ethGetBlock } = MuonAppUtils;

const HttpProvider = Web3.providers.HttpProvider;
const w3 = new Web3(
  new HttpProvider(
    process.env.WEB3_PROVIDER_BSCTEST || "https://bsc-testnet.publicnode.com",
  ),
);

const MUON_NODE_STAKING_ADDR = "0xd788C2276A6f75a8B9360E9695028329C925b0AB";
const MUON_NODE_STAKING_ABI = [{"inputs":[{"internalType":"address","name":"stakerAddress","type":"address"}],"name":"earned","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardPerToken","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"users","outputs":[{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"paidReward","type":"uint256"},{"internalType":"uint256","name":"paidRewardPerToken","type":"uint256"},{"internalType":"uint256","name":"pendingRewards","type":"uint256"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"stateMutability":"view","type":"function"}];
const stakingContract = new w3.eth.Contract(
  MUON_NODE_STAKING_ABI,
  MUON_NODE_STAKING_ADDR,
);
stakingContract.address = MUON_NODE_STAKING_ADDR;

const MUON_NODE_MANAGER_ADDR = "0x25B019d98CF6FBcD73C92C468A352449e2BB39C2";
const MUON_NODE_MANAGER_ABI = [{"inputs":[{"internalType":"address","name":"stakerAddress","type":"address"}],"name":"stakerAddressInfo","outputs":[{"components":[{"internalType":"uint64","name":"id","type":"uint64"},{"internalType":"address","name":"nodeAddress","type":"address"},{"internalType":"address","name":"stakerAddress","type":"address"},{"internalType":"string","name":"peerId","type":"string"},{"internalType":"bool","name":"active","type":"bool"},{"internalType":"uint8","name":"tier","type":"uint8"},{"internalType":"uint64[]","name":"roles","type":"uint64[]"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"uint256","name":"lastEditTime","type":"uint256"}],"internalType":"struct IMuonNodeManager.Node","name":"node","type":"tuple"}],"stateMutability":"view","type":"function"}];
const nodeManagerContract = new w3.eth.Contract(
  MUON_NODE_MANAGER_ABI,
  MUON_NODE_MANAGER_ADDR,
);
nodeManagerContract.address = MUON_NODE_MANAGER_ADDR;

const MONITORING_SERVERS = ["https://alice-v2.muon.net/monitor"];

module.exports = {
  APP_NAME: "tss_reward_oracle",

  getOnlinePercent: async function (nodeId, startTime, endTime) {
    let logs = [];
    for (let monitoringServer of MONITORING_SERVERS) {
      const resp = await axios
        .get(`${monitoringServer}/nodes/${nodeId}/status`)
        .then(({ data }) => data.result)
        .catch((err) => {
          console.log(err);
        });
      logs.push(...resp["history"]);
    }

    logs.sort((a, b) => a.timestamp - b.timestamp);

    // filter the extra logs
    const filteredLogs = logs.filter((log, i) =>
      i == 0 ? true : logs[i - 1].isOnline != log.isOnline,
    );

    onlineTime = 0;
    filteredLogs.map((log, i) => {
      if (log.isOnline) {
        onlineTime +=
          (filteredLogs[i + 1]?.timestamp || endTime) - log.timestamp;
      }
    });

    const onlinePercent =
      onlineTime > 0
        ? (onlineTime * 100) / (endTime - filteredLogs[0]["timestamp"])
        : 0;

    if (onlinePercent < 0 || onlinePercent > 100) {
      throw {
        message: "Online percent is out of range.",
      };
    }

    return onlinePercent;
  },

  getRewardPercent: function (onlinePercent) {
    if (onlinePercent >= 90) {
      return 100;
    } else if (onlinePercent >= 50 && onlinePercent < 90) {
      return onlinePercent;
    } else if (onlinePercent < 50) {
      return 0;
    }
  },

  makeEthCallRequest: function (id, contract, method, inputs, toBlock) {
    return {
      jsonrpc: "2.0",
      id,
      method: "eth_call",
      params: [
        {
          to: contract.address,
          data: contract.methods[method](...inputs).encodeABI(),
        },
        "0x" + toBlock.toString(16),
      ],
    };
  },

  makeBatchRequest: async function (requests) {
    let batch = new w3.BatchRequest();
    requests.forEach((request) => batch.add(request.req));
    const responses = await batch.execute();

    let results = new Array(requests.length);
    for (let res of responses) {
      results[res.id] = requests[res.id].decoder
        ? requests[res.id].decoder(res.result)
        : res.result;
    }
    return results;
  },

  stakerAddressInfoDecoder: function (res) {
    const data = w3.eth.abi.decodeParameters(
      [
        {
          components: [
            { internalType: "uint64", name: "id", type: "uint64" },
            { internalType: "address", name: "nodeAddress", type: "address" },
            { internalType: "address", name: "stakerAddress", type: "address" },
            { internalType: "string", name: "peerId", type: "string" },
            { internalType: "bool", name: "active", type: "bool" },
            { internalType: "uint8", name: "tier", type: "uint8" },
            { internalType: "uint64[]", name: "roles", type: "uint64[]" },
            { internalType: "uint256", name: "startTime", type: "uint256" },
            { internalType: "uint256", name: "endTime", type: "uint256" },
            { internalType: "uint256", name: "lastEditTime", type: "uint256" },
          ],
          internalType: "struct IMuonNodeManager.Node",
          name: "node",
          type: "tuple",
        },
      ],
      res,
    );
    return data["0"];
  },

  rewardPerTokenDecoder: function (res) {
    const data = w3.eth.abi.decodeParameters(
      [{ internalType: "uint256", name: "", type: "uint256" }],
      res,
    );
    return data["0"];
  },

  earnedDecoder: function (res) {
    const data = w3.eth.abi.decodeParameters(
      [{ internalType: "uint256", name: "", type: "uint256" }],
      res,
    );
    return data["0"];
  },

  usersDecoder: function (res) {
    const data = w3.eth.abi.decodeParameters(
      [
        { internalType: "uint256", name: "balance", type: "uint256" },
        { internalType: "uint256", name: "paidReward", type: "uint256" },
        {
          internalType: "uint256",
          name: "paidRewardPerToken",
          type: "uint256",
        },
        { internalType: "uint256", name: "pendingRewards", type: "uint256" },
        { internalType: "uint256", name: "tokenId", type: "uint256" },
      ],
      res,
    );
    return data;
  },

  onRequest: async function (request) {
    const {
      method,
      data: { params },
    } = request;
    let { stakerAddress, blockNumber } = params;
    blockNumber = Number(blockNumber);

    switch (method) {
      case "reward":
        let reward = 0;

        const requests = [
          {
            req: this.makeEthCallRequest(
              0,
              nodeManagerContract,
              "stakerAddressInfo",
              [stakerAddress],
              blockNumber,
            ),
            decoder: this.stakerAddressInfoDecoder,
          },
          {
            req: this.makeEthCallRequest(
              1,
              stakingContract,
              "users",
              [stakerAddress],
              blockNumber,
            ),
            decoder: this.usersDecoder,
          },
          {
            req: this.makeEthCallRequest(
              2,
              stakingContract,
              "earned",
              [stakerAddress],
              blockNumber,
            ),
            decoder: this.earnedDecoder,
          },
          {
            req: this.makeEthCallRequest(
              3,
              stakingContract,
              "rewardPerToken",
              [],
              blockNumber,
            ),
            decoder: this.rewardPerTokenDecoder,
          },
        ];
        let [node, user, earned, rewardPerToken] =
          await this.makeBatchRequest(requests);

        const block = await ethGetBlock("bsctest", blockNumber);
        // if the node is active the endTime is now otherwise endTime is the node exit time
        endTime =
          node.endTime > 0 ? Number(node.endTime) : Number(block.timestamp);

        const onlinePercent = await this.getOnlinePercent(
          node.id,
          node.startTime,
          endTime,
        );

        const rewardPercent = this.getRewardPercent(onlinePercent);

        if (node.active) {
          reward = Math.floor((Number(earned) * rewardPercent) / 100);
        } else {
          reward = Math.floor((Number(user.pendingRewards) * rewardPercent) / 100);
        }

        return {
          stakerAddress,
          paidReward: user.paidReward.toString(),
          rewardPerToken: rewardPerToken.toString(),
          reward: reward.toString(),
        };

      default:
        throw `Unknown method ${method}`;
    }
  },

  signParams: function (request, result) {
    let { method } = request;
    let { stakerAddress, paidReward, rewardPerToken, reward } = result;

    switch (method) {
      case "reward":
        return [
          { type: "address", value: stakerAddress },
          { type: "uint256", value: paidReward },
          {
            type: "uint256",
            value: rewardPerToken,
          },
          { type: "uint256", value: reward },
        ];

      default:
        throw `Unknown method ${method}`;
    }
  },
};
