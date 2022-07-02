const ParentOraclesV2 = require('./parent_oracles_v2')
const {
  GRAPH_URL,
  GRAPH_DEPLOYMENT_ID
} = require('./parent_oracles.constant.json')
const APP_CONFIG = {}

// TODO: subgraphs for sushi and uniswap don't work so this app only work if our exchange was not those - it's obvious that doesn't work for beetsfi too and it's completely different
module.exports = {
  ...ParentOraclesV2,

  APP_NAME: 'permissionless_oracles_vwap_v2',
  config: APP_CONFIG,

  prepareTokenTx: async function (pair, exchange, start, end, chainId) {
    if (exchange === 'sushi') {
      const tokenTxs = await this.getTokenTxs(
        pair,
        GRAPH_URL[exchange][chainId],
        GRAPH_DEPLOYMENT_ID[exchange][chainId],
        start,
        end
      )
      return tokenTxs
    }
    const tokenTxs = await this.getTokenTxs(
      pair,
      GRAPH_URL[exchange],
      GRAPH_DEPLOYMENT_ID[exchange],
      start,
      end
    )

    return tokenTxs
  }
}
