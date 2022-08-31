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
        const chainId = 250
        const seed = {
            price0: new BN('553937927341650325448601038471856'),
            blockNumber: 14506224
        }
        const blocksWithEvent = {
            1: '14506230',
            2: '14506280'
        }
        const syncEventsMap = {
            [blocksWithEvent[1]]: {
                returnValues: {
                    reserve0: '399657354506030558473',
                    reserve1: '50540763706853586504',
                }
            },

            [blocksWithEvent[2]]: {
                returnValues: {
                    reserve0: '407073280527237345605',
                    reserve1: '49622740867094652888',
                }
            }
        }

        const prices = app.createPrices(chainId, seed, syncEventsMap)

        assert(
            prices.length == networksBlocks[chainId]['seed'] + 1,
            `${injectColor(BLUE, 'Prices array has invalid length')}
            Expected: ${injectColor(GREEN, networksBlocks[chainId]['seed'] + 1)}
            Received: ${injectColor(RED, prices.length)}`
        )
        assert(
            prices[0].eq(seed.price0),
            `${injectColor(BLUE, 'Zero index must be seed price')}
            Expected: ${injectColor(GREEN, seed.price0)} 
            Received: ${injectColor(RED, prices[0])}
            `
        )
        let gaps = []
        // calculate gaps between blocks with sync event
        Object.values(blocksWithEvent).forEach((block, index) => gaps[index] = block - seed.blockNumber)
        // check if for each gap the correct price has been set
        let result
        let lastGap = 0
        let expectedPrice = seed.price0
        gaps.forEach((gap, j) => {
            // create a set of prices for each gap
            result = new Set(prices.slice(lastGap, gap))
            // check if each gap has one price
            assert(
                result.size == 1,
                `${injectColor(BLUE, 'Multiple price for a gap')}`
            )
            // check if gap price is correct
            assert(
                [...result][0].eq(expectedPrice),
                `${injectColor(BLUE, 'Wrong price set for block')}
                Expected: ${injectColor(GREEN, expectedPrice)}
                Received: ${injectColor(RED, [...result][0])})`
            )

            const { reserve0, reserve1 } = syncEventsMap[blocksWithEvent[j + 1]].returnValues
            expectedPrice = app.calculateInstantPrice(reserve0, reserve1)
            lastGap = gap
        })
    })

    it('Test removeOutlierZScore', async () => {
        expect(false).toBe(true)
    })
})
