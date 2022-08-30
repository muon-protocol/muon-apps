
require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../src/core/global')

const { dynamicExtend } = require('../../src/core/utils')
const PriceFeedApp = dynamicExtend(
    class { },
    require('../general/price_feed')
)
const app = new PriceFeedApp()
const {
    CHAINS,
    networksWeb3,
    networksBlocks,
    THRESHOLD,
    PRICE_TOLERANCE,
    FUSE_PRICE_TOLERANCE,
    Q112,
    ETH,
    UNISWAPV2_PAIR_ABI,
    BN,
    toBaseUnit,
} = app


describe('Price Feed app unit test', () => {
    it('Test getSyncEvents', async () => {
        expect(false).toBe(true)
    })
    it('Test createPrices', async () => {
        expect(false).toBe(true)
    })
    it('Test removeOutlierZScore', async () => {
        expect(false).toBe(true)
    })
})
