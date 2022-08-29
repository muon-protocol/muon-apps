require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../src/core/global')
const assert = require('assert')
const { dynamicExtend } = require('../../src/core/utils')
const PriceFeedApp = dynamicExtend(
    class { },
    require('../general/price_feed')
)

const Red = "\x1b[31m"
const Green = "\x1b[32m"
const Blue = "\x1b[34m"
const Reset = "\x1b[0m"

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

const testGetSeed = async () => {
    throw 'error'    
}

const testGetSyncEvents = async () => {
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
            assert(syncEventsMap[event.blockNumber].transactionHash == event.transactionHash, `transactionIndex ${event.transactionHash}, ${syncEventsMap[event.blockNumber].transactionHash}`)
            assert(syncEventsMap[event.blockNumber].logIndex == event.logIndex, `logIndex ${event.logIndex}, ${syncEventsMap[event.blockNumber].logIndex}, ${event.blockNumber}`)
            lastEvent = event
            counter++
        }
    })
    assert(counter == numberOfEvents, `Difference in number of events ${counter} ${numberOfEvents}`)
}

const testCreatePrices = async () => {
    const chainId = 250
    const seed = {
        price0: new BN('553937927341650325448601038471856'),
        blockNumber: 14506224
    }
    const syncEventsMap = {
        '14506230': {
            returnValues: {
                reserve0: '399657354506030558473',
                reserve1: '50540763706853586504',
            }
        },

        '14506280': {
            returnValues: {
                reserve0: '407073280527237345605',
                reserve1: '49622740867094652888',
            }
        }
    }

    const prices = app.createPrices(chainId, seed, syncEventsMap)

    assert(prices.length == networksBlocks[chainId]['seed'] + 1, `prices array has invalid length [${prices.length},${networksBlocks[chainId]['seed'] + 1}]`)
    assert(prices[0] == seed.price0)
    for (var i = 0; i < prices.length; i++) {
        if (i < 14506230 - 14506224) assert(prices[i].eq(seed.price0), `gap1: ${prices[i]}, ${seed.price0}`)
        else if (i < 14506280 - 14506224) assert(prices[i].eq(app.calculateInstantPrice('399657354506030558473', '50540763706853586504')), `gap2: ${prices[i]}, ${app.calculateInstantPrice('399657354506030558473', '50540763706853586504')}`)
        else assert(prices[i].eq(app.calculateInstantPrice('407073280527237345605', '49622740867094652888')), `gap3: ${prices[i]}, ${app.calculateInstantPrice('407073280527237345605', '49622740867094652888')}`)
    }
}

const testStd = async() => {
    throw 'error'
}

const testCalculateAveragePrice = async() => {
    throw 'error'
}

const testRemoveOutlierZScore = async() => {
    throw 'error'
}

const testRemoveOutlier = async() => {
    throw 'error'
}

const testGetFusePrice = async() => {
    throw 'error'
}

const testCheckFusePrice = async() => {
    throw 'error'
}


const tests = [
    testGetSeed,
    testGetSyncEvents,
    testCreatePrices,
    testStd,
    testCalculateAveragePrice,
    testRemoveOutlierZScore,
    testRemoveOutlier,
    testGetFusePrice,
    testCheckFusePrice,
]

tests.forEach((test) => {
    test()
        .then(() => console.log(`${Green}Passed ${Blue}${test.name}`))
        .catch((error) => {
            console.log(`${Red}Failed ${Blue}${test.name}${Reset}`)
            console.log('\t', error.message)
        })
})