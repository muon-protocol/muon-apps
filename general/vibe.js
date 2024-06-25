const { axios, BN, toBaseUnit } = MuonAppUtils;
const subgraphUrl =
  "https://api.studio.thegraph.com/query/62454/vibe_rewarder/version/latest";
const SCALE = new BN(toBaseUnit('1', '18'))

const Vibe = {
  APP_NAME: "vibe",
  useTss: true,

  postQuery: async function (query) {
    const {
      data: { data },
    } = await axios.post(subgraphUrl, {
      query: query,
    });
    console.log(query);
    return data;
  },

  getDailyUserHistories: async function (activeNftId, day_lte, account) {
    const query = `{
      dailyUserHistories(where: {activeNftId: "${activeNftId}", day_lte: "${day_lte}", account: "${account}"}) {
        day
        activeNftId
        platformFeePaid
        timestamp
      }
    }`;
    const data = await this.postQuery(query);
    console.log(data);
    return data.dailyUserHistories;
  },

  getRackbacks: async function (addedTimestamp_lte) {
    const query = `{
      volumeRakebackTiers(where: {addedTimestamp_lte: "${Math.floor(
        addedTimestamp_lte
      )}"}, orderBy: maxVolume) {
        addedTimestamp
        maxVolume
        rakebackRatio
        removedTimestamp
      }
    }`;
    const data = await this.postQuery(query);
    return data.volumeRakebackTiers;
  },

  findTier: function (timestamp, volume, volumeRakebackTiers) {
    return volumeRakebackTiers.find((tier) => {
      const isWithinTimestamp =
        tier.addedTimestamp <= timestamp &&
        (!tier.removedTimestamp || tier.removedTimestamp > timestamp);
      const isWithinVolume = new BN(volume) <= new BN(tier.maxVolume);
      return isWithinTimestamp && isWithinVolume;
    });
  },

  calculateSum: async function (nftId, timestamp, account) {
    const day = Math.floor(timestamp / 86400);
    const records = await this.getDailyUserHistories(nftId, day, account);
    const volumeRakebackTiers = await this.getRackbacks(timestamp);
    console.log(volumeRakebackTiers);
    console.log(records);

    return records.reduce((sum, record) => {
      const tier = this.findTier(
        record.timestamp,
        record.volume,
        volumeRakebackTiers
      );
      if (tier) {
        const platformFeePaid = new BN(record.platformFeePaid);
        const rakebackRatio = new BN(tier.rakebackRatio);
        const calculatedRakeback = platformFeePaid.mul(rakebackRatio).div(SCALE);
        return sum.add(calculatedRakeback);
      }
      return sum;
    }, new BN(0));
  },

  onRequest: async function (request) {
    let {
      method,
      data: { params = {} },
    } = request;
    let { nftId, account } = params;
    switch (method) {
      case "claim":
        const timestamp = Math.floor(Date.now() / 1000);
        const lastDay = Math.floor(timestamp / 86400);

        const amount = (
          await this.calculateSum(nftId, timestamp, account)
        ).toString();
        return { nftId, account, amount, lastDay, timestamp };
      default:
        throw { message: `invalid method ${method}` };
    }
  },

  signParams: function (request, result) {
    switch (request.method) {
      case "claim":
        let { nftId, account, amount, lastDay, timestamp } = result;
        return [
          { name: "nftId", type: "uint256", value: nftId },
          { name: "account", type: "address", value: account },
          { name: "amount", type: "uint256", value: amount },
          { name: "lastDay", type: "uint256", value: lastDay },
          { name: "timestamp", type: "uint256", value: timestamp },
        ];
      default:
        throw { message: `Unknown method: ${request.method}` };
    }
  },
};

module.exports = Referral;
