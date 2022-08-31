require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../src/core/global')
const assert = require('assert')

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

const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const BLUE = "\x1b[34m"
const CYAN = "\x1b[36m"
const RESET = "\x1b[0m"
function injectColor(color, text) {
    return color + text
}


describe('Price Feed app unit test', () => {
    it('Test getSyncEvents', async () => {
        const chainId = 1
        const seedBlockNumber = 14506359
        const pairAddress = '0x328dfd0139e26cb0fef7b0742b49b0fe4325f821'

        const w3 = networksWeb3[chainId]
        const pair = new w3.eth.Contract(UNISWAPV2_PAIR_ABI, pairAddress)
        const options = {
            fromBlock: seedBlockNumber + 1,
            toBlock: seedBlockNumber + networksBlocks[chainId]['seed']
        }
        const syncEvents = await pair.getPastEvents("Sync", options)

        const syncEventsMap = await app.getSyncEvents(chainId, seedBlockNumber, pairAddress)
        const numberOfEvents = Object.keys(syncEventsMap).length

        let lastEvent = {
            blockNumber: 0
        }
        let counter = 0
        syncEvents.reverse().forEach((event) => {
            if (lastEvent.blockNumber != event.blockNumber) {
                const result = syncEventsMap[event.blockNumber]
                assert(
                    result.transactionHash == event.transactionHash,
                    `${injectColor(BLUE, 'Transaction hash must be the same')}
                    Expected: ${injectColor(GREEN, event.transactionHash)}
                    Received: ${injectColor(RED, result.transactionHash)}`
                )
                assert(
                    result.logIndex == event.logIndex,
                    `${injectColor(BLUE, 'Log index must be the same')}
                    Expected: ${injectColor(GREEN, event.logIndex)}
                    Received: ${injectColor(RED, result.logIndex)}
                    BlockNumber: ${injectColor(CYAN, event.blockNumber)}`
                )
                lastEvent = event
                counter++
            }
        })
        assert(
            counter == numberOfEvents,
            `${injectColor(BLUE, 'Number of events must be the same')}
            Expected: ${injectColor(GREEN, counter)}
            Received: ${injectColor(RED, numberOfEvents)} `
        )
    })
    it('Test createPrices', async () => {
        expect(false).toBe(true)
    })
    it('Test removeOutlierZScore', async () => {
        expect(false).toBe(true)
    })
})
