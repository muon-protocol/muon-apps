const { toBaseUnit, BN, Web3 } = MuonAppUtils

const HttpProvider = Web3.providers.HttpProvider

const CHAINS = {
    mainnet: 1,
    fantom: 250,
    polygon: 137,
}

const networksWeb3 = {
    [CHAINS.mainnet]: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_ETH)),
    [CHAINS.fantom]: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_FTM)),
    [CHAINS.polygon]: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_POLYGON)),
}

const networksBlocksPerMinute = {
    [CHAINS.mainnet]: 5,
    [CHAINS.fantom]: 52,
    [CHAINS.polygon]: 29,
}

const THRESHOLD = 2
const FUSE_PRICE_TOLERANCE = '0.1'
const Q112 = new BN(2).pow(new BN(112))
const ETH = new BN(toBaseUnit('1', '18'))

const UNISWAPV2_PAIR_ABI = [{ "constant": true, "inputs": [], "name": "getReserves", "outputs": [{ "internalType": "uint112", "name": "_reserve0", "type": "uint112" }, { "internalType": "uint112", "name": "_reserve1", "type": "uint112" }, { "internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32" }], "payable": false, "stateMutability": "view", "type": "function" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint112", "name": "reserve0", "type": "uint112" }, { "indexed": false, "internalType": "uint112", "name": "reserve1", "type": "uint112" }], "name": "Sync", "type": "event" }, { "inputs": [], "name": "price0CumulativeLast", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "price1CumulativeLast", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }]

module.exports = {
    CHAINS,
    networksWeb3,
    THRESHOLD,
    FUSE_PRICE_TOLERANCE,
    Q112,
    ETH,
    UNISWAPV2_PAIR_ABI,
    BN,
    toBaseUnit,


    APP_NAME: 'price_feed',

    isPriceToleranceOk: function (price, expectedPrice, priceTolerance) {
        let priceDiff = new BN(price).sub(new BN(expectedPrice)).abs()
        const priceDiffPercentage = new BN(priceDiff).mul(ETH).div(new BN(expectedPrice))
        return {
            isOk: !priceDiffPercentage.gt(new BN(priceTolerance)),
            priceDiffPercentage: priceDiffPercentage.mul(new BN(100)).div(ETH)
        }
    },

    calculateInstantPrice: function (reserve0, reserve1) {
        // multiply reserveA into Q112 for precision in division 
        // reserveA * (2 ** 112) / reserverB
        const price0 = new BN(reserve1).mul(Q112).div(new BN(reserve0))
        return price0
    },

    getSeed: async function (chainId, pairAddress, blocksToSeed, toBlock) {
        const w3 = networksWeb3[chainId]
        const seedBlockNumber = toBlock - blocksToSeed

        const pair = new w3.eth.Contract(UNISWAPV2_PAIR_ABI, pairAddress)
        const { _reserve0, _reserve1 } = await pair.methods.getReserves().call(seedBlockNumber)
        const price0 = this.calculateInstantPrice(_reserve0, _reserve1)
        return { price0: price0, blockNumber: seedBlockNumber }
    },

    getSyncEvents: async function (chainId, seedBlockNumber, pairAddress, blocksToSeed) {
        const w3 = networksWeb3[chainId]
        const pair = new w3.eth.Contract(UNISWAPV2_PAIR_ABI, pairAddress)
        const options = {
            fromBlock: seedBlockNumber + 1,
            toBlock: seedBlockNumber + blocksToSeed
        }
        const syncEvents = await pair.getPastEvents("Sync", options)
        let syncEventsMap = {}
        // {key: event.blockNumber => value: event}
        syncEvents.forEach((event) => syncEventsMap[event.blockNumber] = event)
        return syncEventsMap
    },

    createPrices: function (chainId, seed, syncEventsMap, blocksToSeed) {

        let prices = [seed.price0]
        let price = seed.price0
        // fill prices and consider a price for each block between seed and current block
        for (let blockNumber = seed.blockNumber + 1; blockNumber <= seed.blockNumber + blocksToSeed; blockNumber++) {
            // use block event price if there is an event for the block
            // otherwise use last event price
            if (syncEventsMap[blockNumber]) {
                const { reserve0, reserve1 } = syncEventsMap[blockNumber].returnValues
                price = this.calculateInstantPrice(reserve0, reserve1)
            }
            prices.push(price)
        }
        return prices
    },

    std: function (arr) {
        let mean = arr.reduce((result, el) => result + el, 0) / arr.length
        arr = arr.map((k) => (k - mean) ** 2)
        let sum = arr.reduce((result, el) => result + el, 0)
        let variance = sum / arr.length
        return Math.sqrt(variance)
    },

    removeOutlierZScore: function (prices) {
        const mean = this.calculateAveragePrice(prices)
        // calculate std(standard deviation)
        const std = this.std(prices)
        if (std == 0) return prices

        // Z score = (price - mean) / std
        // price is not reliable if Z score < threshold
        return prices.filter((price) => Math.abs(price - mean) / std < THRESHOLD)
    },

    removeOutlier: function (prices) {
        const logPrices = []
        prices.forEach((price) => {
            logPrices.push(Math.log(price));
        })
        let logOutlierRemoved = this.removeOutlierZScore(logPrices)

        logOutlierRemoved = this.removeOutlierZScore(logOutlierRemoved)

        const outlierRemoved = []
        const removed = []
        prices.forEach((price, index) => logOutlierRemoved.includes(logPrices[index]) ? outlierRemoved.push(price) : removed.push(price.toString()))

        return { outlierRemoved, removed }
    },

    calculateAveragePrice: function (prices, returnReverse) {
        let fn = function (result, el) {
            return returnReverse ? { price0: result.price0.add(el), price1: result.price1.add(Q112.mul(Q112).div(el)) } : result + el
        }
        const sumPrice = prices.reduce(fn, returnReverse ? { price0: new BN(0), price1: new BN(0) } : 0)
        const averagePrice = returnReverse ? { price0: sumPrice.price0.div(new BN(prices.length)), price1: sumPrice.price1.div(new BN(prices.length)) } : sumPrice / prices.length
        return averagePrice
    },

    makeBatchRequest: function (w3, calls) {
        let batch = new w3.BatchRequest();

        let promises = calls.map(call => {
            return new Promise((res, rej) => {
                let req = call.req.request(call.block, (err, data) => {
                    if (err) rej(err);
                    else res(data)
                });
                batch.add(req)
            })
        })
        batch.execute()

        return Promise.all(promises)
    },

    updatePriceCumulativeLasts: function (_price0CumulativeLast, _price1CumulativeLast, toBlockReserves, toBlockTimestamp) {
        const timestampLast = toBlockTimestamp % 2 ** 32
        if (timestampLast != toBlockReserves._blockTimestampLast) {
            const period = new BN(timestampLast - toBlockReserves._blockTimestampLast)
            const price0CumulativeLast = new BN(_price0CumulativeLast).add(this.calculateInstantPrice(toBlockReserves._reserve0, toBlockReserves._reserve1).mul(period))
            const price1CumulativeLast = new BN(_price1CumulativeLast).add(this.calculateInstantPrice(toBlockReserves._reserve1, toBlockReserves._reserve0).mul(period))
            return { price0CumulativeLast, price1CumulativeLast }
        }
        else return { price0CumulativeLast: _price0CumulativeLast, price1CumulativeLast: _price1CumulativeLast }
    },

    getFusePrice: async function (chainId, pairAddress, toBlock, blocksToFuse) {
        const w3 = networksWeb3[chainId]
        const pair = new w3.eth.Contract(UNISWAPV2_PAIR_ABI, pairAddress)
        const seedBlockNumber = toBlock - blocksToFuse
        let [
            _price0CumulativeLast,
            _price1CumulativeLast,
            toReserves,
            to,
            _seedPrice0CumulativeLast,
            _seedPrice1CumulativeLast,
            seedReserves,
            seed,
        ] = await this.makeBatchRequest(w3, [
            // reqs to get priceCumulativeLast of toBlock
            { req: pair.methods.price0CumulativeLast().call, block: toBlock },
            { req: pair.methods.price1CumulativeLast().call, block: toBlock },
            { req: pair.methods.getReserves().call, block: toBlock },
            { req: w3.eth.getBlock, block: toBlock },
            // reqs to get priceCumulativeLast of seedBlock 
            { req: pair.methods.price0CumulativeLast().call, block: seedBlockNumber },
            { req: pair.methods.price1CumulativeLast().call, block: seedBlockNumber },
            { req: pair.methods.getReserves().call, block: seedBlockNumber },
            { req: w3.eth.getBlock, block: seedBlockNumber },
        ])

        const { price0CumulativeLast, price1CumulativeLast } = this.updatePriceCumulativeLasts(_price0CumulativeLast, _price1CumulativeLast, toReserves, to.timestamp)
        const { price0CumulativeLast: seedPrice0CumulativeLast, price1CumulativeLast: seedPrice1CumulativeLast } = this.updatePriceCumulativeLasts(_seedPrice0CumulativeLast, _seedPrice1CumulativeLast, seedReserves, seed.timestamp)

        const period = new BN(to.timestamp).sub(new BN(seed.timestamp)).abs()

        return {
            price0: new BN(price0CumulativeLast).sub(new BN(seedPrice0CumulativeLast)).div(period),
            price1: new BN(price1CumulativeLast).sub(new BN(seedPrice1CumulativeLast)).div(period),
            blockNumber: seedBlockNumber
        }
    },

    checkFusePrice: async function (chainId, pairAddress, price, fusePriceTolerance, blocksToFuse, toBlock) {
        const fusePrice = await this.getFusePrice(chainId, pairAddress, toBlock, blocksToFuse)
        if (fusePrice.price0.eq(new BN(0)))
            return {
                isOk0: true,
                isOk1: true,
                priceDiffPercentage0: new BN(0),
                priceDiffPercentage1: new BN(0),
                block: fusePrice.blockNumber
            }
        const checkResult0 = this.isPriceToleranceOk(price.price0, fusePrice.price0, fusePriceTolerance)
        const checkResult1 = this.isPriceToleranceOk(price.price1, Q112.mul(Q112).div(fusePrice.price0), fusePriceTolerance)
        return {
            isOk0: checkResult0.isOk,
            isOk1: checkResult1.isOk,
            priceDiffPercentage0: checkResult0.priceDiffPercentage,
            priceDiffPercentage1: checkResult1.priceDiffPercentage,
            block: fusePrice.blockNumber
        }
    },

    calculatePairPrice: async function (chainId, pair, toBlock) {
        const blocksToSeed = networksBlocksPerMinute[chainId] * pair.minutesToSeed
        const blocksToFuse = networksBlocksPerMinute[chainId] * pair.minutesToFuse
        // get seed price
        const seed = await this.getSeed(chainId, pair.address, blocksToSeed, toBlock)
        // get sync events that are emitted after seed block
        const syncEventsMap = await this.getSyncEvents(chainId, seed.blockNumber, pair.address, blocksToSeed)
        // create an array contains a price for each block mined after seed block 
        const prices = this.createPrices(chainId, seed, syncEventsMap)
        // remove outlier prices
        const { outlierRemoved, removed } = this.removeOutlier(prices)
        // calculate the average price
        const price = this.calculateAveragePrice(outlierRemoved, true)
        // check for high price change in comparison with fuse price
        const fuse = await this.checkFusePrice(chainId, pair.address, price, pair.fusePriceTolerance, blocksToFuse, toBlock)
        if (!(fuse.isOk0 && fuse.isOk1)) throw { message: `High price gap 0(${fuse.priceDiffPercentage0}%) 1(${fuse.priceDiffPercentage1}%) between fuse and twap price for ${pair.address} in block range ${fuse.block} - ${toBlock}` }

        return {
            price0: price.price0,
            price1: price.price1,
            removed
        }
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request

        switch (method) {
            case 'signature':

                let { chain, pairAddress, toBlock } = params
                if (!chain) throw { message: 'Invalid chain' }

                const chainId = CHAINS[chain]
                if (!request.data.result) {
                    const w3 = networksWeb3[chainId]
                    const currentBlockNumber = await w3.eth.getBlockNumber()
                    if (!toBlock) toBlock = currentBlockNumber
                    else if (toBlock > currentBlockNumber) throw { message: 'Invalid Block Number' }
                }
                else toBlock = request.data.result.toBlock

                const { price0, price1, removed } = await this.calculatePairPrice(chainId, pairAddress, FUSE_PRICE_TOLERANCE, toBlock)

                return {
                    chain: chain,
                    pairAddress: pairAddress,
                    price0: price0.toString(),
                    price1: price1.toString(),
                    removedOutliers: removed,
                    toBlock: toBlock,
                }

            default:
                throw { message: `Unknown method ${params}` }
        }
    },

    /**
     * List of the parameters that need to be signed. 
     * APP_ID, reqId will be added by the
     * Muon Core and [APP_ID, reqId, … signParams]
     * should be verified on chain.
     */
    signParams: function (request, result) {
        let { method } = request
        switch (method) {
            case 'signature': {

                let { chain, pairAddress, price0, price1, toBlock } = result

                return [
                    { type: 'address', value: pairAddress },
                    { type: 'uint256', value: price0 },
                    { type: 'uint256', value: price1 },
                    { type: 'uint256', value: String(CHAINS[chain]) },
                    { type: 'uint256', value: request.data.timestamp },
                    { type: 'uint256', value: toBlock },
                ]

            }
            default:
                break
        }
    }
}
