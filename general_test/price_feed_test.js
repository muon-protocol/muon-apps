require('dotenv').config({ path: './dev-chain/dev-node-1.env' })
require('../../src/core/global')
const { } = require('../general/price_feed')

const Red = "\x1b[31m"
const Green = "\x1b[32m"
const Blue = "\x1b[34m"
const Reset = "\x1b[0m"


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
        // console.log('\t', error)
    })
})