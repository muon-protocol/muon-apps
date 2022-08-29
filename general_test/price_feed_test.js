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

const testGetSyncEvents = async() => {
    throw 'error'
}

const testCreatePrice = async() => {
    throw 'error'
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
    testCreatePrice,
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