const ParentOraclesV3 = require('./parent_oracles_v3')

const APP_CONFIG = {
  chainId: 250
}

// TODO: this app is for all exchange except beetsfi but if there aren't any events we throw error instead of giving price
module.exports = {
  ...ParentOraclesV3,

  APP_NAME: 'permissionless_oracles_vwap_v3',
  config: APP_CONFIG
}
