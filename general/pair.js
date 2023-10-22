const { toBaseUnit, BN, Web3 } = MuonAppUtils

const HttpProvider = Web3.providers.HttpProvider

const CHAINS = {
    mainnet: 1,
    fantom: 250,
    polygon: 137,
    bsc: 56,
    avax: 43114,
}

const networksWeb3 = {
    [CHAINS.mainnet]: new Web3("https://rpc.ankr.com/eth"),
    [CHAINS.fantom]: new Web3("https://rpc.ankr.com/fantom"),
    [CHAINS.polygon]: new Web3("https://rpc.ankr.com/polygon"),
    [CHAINS.bsc]: new Web3("https://rpc.ankr.com/bsc"),
    [CHAINS.avax]: new Web3("https://rpc.ankr.com/avalanche"),
}

const networksBlocksPerMinute = {
    [CHAINS.mainnet]: 5,
    [CHAINS.fantom]: 52,
    [CHAINS.polygon]: 29,
    [CHAINS.bsc]: 12,
    [CHAINS.avax]: 55,
}

const THRESHOLD = 2
const FUSE_PRICE_TOLERANCE = BigInt(0.3e18)
const Q112 = new BN(2).pow(new BN(112))
const ETH = new BN(toBaseUnit('1', '18'))

const UNISWAPV2_PAIR_ABI = [{ "constant": true, "inputs": [], "name": "getReserves", "outputs": [{ "internalType": "uint112", "name": "_reserve0", "type": "uint112" }, { "internalType": "uint112", "name": "_reserve1", "type": "uint112" }, { "internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32" }], "payable": false, "stateMutability": "view", "type": "function" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint112", "name": "reserve0", "type": "uint112" }, { "indexed": false, "internalType": "uint112", "name": "reserve1", "type": "uint112" }], "name": "Sync", "type": "event" }, { "inputs": [], "name": "price0CumulativeLast", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "price1CumulativeLast", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }]
const SOLIDLY_PAIR_ABI = [{ "inputs": [], "name": "observationLength", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "tokenIn", "type": "address" }, { "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "points", "type": "uint256" }, { "internalType": "uint256", "name": "window", "type": "uint256" }], "name": "sample", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "metadata", "outputs": [{ "internalType": "uint256", "name": "dec0", "type": "uint256" }, { "internalType": "uint256", "name": "dec1", "type": "uint256" }, { "internalType": "uint256", "name": "r0", "type": "uint256" }, { "internalType": "uint256", "name": "r1", "type": "uint256" }, { "internalType": "bool", "name": "st", "type": "bool" }, { "internalType": "address", "name": "t0", "type": "address" }, { "internalType": "address", "name": "t1", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "reserve0", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "reserve1", "type": "uint256" }], "name": "Sync", "type": "event" }, { "inputs": [], "name": "getReserves", "outputs": [{ "internalType": "uint256", "name": "_reserve0", "type": "uint256" }, { "internalType": "uint256", "name": "_reserve1", "type": "uint256" }, { "internalType": "uint256", "name": "_blockTimestampLast", "type": "uint256" }], "stateMutability": "view", "type": "function" }]

const ABIS = {
    UniV2: UNISWAPV2_PAIR_ABI,
    Solidly: SOLIDLY_PAIR_ABI,
}

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

    getSeed: async function (chainId, pairAddress, blocksToSeed, toBlock, abiStyle) {
        const w3 = networksWeb3[chainId]
        const seedBlockNumber = toBlock - blocksToSeed
        const pair = new w3.eth.Contract(ABIS[abiStyle], pairAddress)
        const { _reserve0, _reserve1 } = await pair.methods.getReserves().call(undefined, seedBlockNumber)
        const price0 = this.calculateInstantPrice(_reserve0, _reserve1)
        return { price0: price0, blockNumber: seedBlockNumber }
    },

    getSyncEvents: async function (chainId, seedBlockNumber, pairAddress, blocksToSeed, abiStyle) {
        const w3 = networksWeb3[chainId]
        const pair = new w3.eth.Contract(ABIS[abiStyle], pairAddress)
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

    createPrices: function (seed, syncEventsMap, blocksToSeed) {
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

    makeEthCallRequest: function (id, contract, method, inputs, toBlock) {
        return {
            jsonrpc: '2.0',
            id,
            method: 'eth_call',
            params: [
                {
                    to: contract.address,
                    data: contract.methods[method](...inputs).encodeABI()
                },
                "0x" + toBlock.toString(16),
            ]

        }
    },

    makeEthGetBlockRequest: function (id, toBlock) {
        return {
            jsonrpc: '2.0',
            id,
            method: 'eth_getBlockByNumber',
            params: ['0x' + toBlock.toString(16), false]
        }

    },

    makeBatchRequest: async function (w3, requests) {
        let batch = new w3.BatchRequest();

        requests.forEach((request) => {
            batch.add(request.req)
                .catch(err => {
                    return {success: false, message: err.message};
                });
        });
        const responses = await batch.execute()
            .catch(e => {
                throw {message: `Batch request failed: ${e.message}`};
            });

        let results = new Array(requests.length)
        for (let res of responses) {
            results[res.id] = requests[res.id].decoder ? requests[res.id].decoder(res.result) : res.result
        }

        return results
    },

    updatePriceCumulativeLasts: function (_price0CumulativeLast, _price1CumulativeLast, toBlockReserves, toBlockTimestamp) {
        const timestampLast = BigInt(toBlockTimestamp) % 2n ** 32n
        if (timestampLast != toBlockReserves._blockTimestampLast) {
            const period = new BN(timestampLast - toBlockReserves._blockTimestampLast)
            const price0CumulativeLast = new BN(_price0CumulativeLast).add(this.calculateInstantPrice(toBlockReserves._reserve0, toBlockReserves._reserve1).mul(period))
            const price1CumulativeLast = new BN(_price1CumulativeLast).add(this.calculateInstantPrice(toBlockReserves._reserve1, toBlockReserves._reserve0).mul(period))
            return { price0CumulativeLast, price1CumulativeLast }
        }
        else return { price0CumulativeLast: _price0CumulativeLast, price1CumulativeLast: _price1CumulativeLast }
    },

    getFusePrice: async function (w3, pairAddress, toBlock, seedBlock, abiStyle) {
        const reservesDecoder = (res) => { return w3.eth.abi.decodeParameters([{ "internalType": "uint112", "name": "_reserve0", "type": "uint112" }, { "internalType": "uint112", "name": "_reserve1", "type": "uint112" }, { "internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32" }], res) }
        const priceCumulativeLastDecoder = (res) => { return w3.eth.abi.decodeParameters([{ "internalType": "uint256", "name": "", "type": "uint256" }], res) }
        const getFusePriceUniV2 = async (w3, pairAddress, toBlock, seedBlock) => {
            const pair = new w3.eth.Contract(UNISWAPV2_PAIR_ABI, pairAddress)
            pair.address = pairAddress


            const requests = [
                // reqs to get priceCumulativeLast of toBlock
                { req: this.makeEthCallRequest(0, pair, 'price0CumulativeLast', [], toBlock), decoder: priceCumulativeLastDecoder },
                { req: this.makeEthCallRequest(1, pair, 'price1CumulativeLast', [], toBlock), decoder: priceCumulativeLastDecoder },
                { req: this.makeEthCallRequest(2, pair, 'getReserves', [], toBlock), decoder: reservesDecoder },
                { req: this.makeEthGetBlockRequest(3, toBlock) },
                // reqs to get priceCumulativeLast of seedBlock 
                { req: this.makeEthCallRequest(4, pair, 'price0CumulativeLast', [], seedBlock), decoder: priceCumulativeLastDecoder },
                { req: this.makeEthCallRequest(5, pair, 'price1CumulativeLast', [], seedBlock), decoder: priceCumulativeLastDecoder },
                { req: this.makeEthCallRequest(6, pair, 'getReserves', [], seedBlock), decoder: reservesDecoder },
                { req: this.makeEthGetBlockRequest(7, seedBlock) },
            ]

            let [
                _price0CumulativeLast,
                _price1CumulativeLast,
                toReserves,
                to,
                _seedPrice0CumulativeLast,
                _seedPrice1CumulativeLast,
                seedReserves,
                seed,
            ] = await this.makeBatchRequest(w3, requests)


            const { price0CumulativeLast, price1CumulativeLast } = this.updatePriceCumulativeLasts(_price0CumulativeLast['0'], _price1CumulativeLast['0'], toReserves, to.timestamp)
            const { price0CumulativeLast: seedPrice0CumulativeLast, price1CumulativeLast: seedPrice1CumulativeLast } = this.updatePriceCumulativeLasts(_seedPrice0CumulativeLast['0'], _seedPrice1CumulativeLast['0'], seedReserves, seed.timestamp)

            const period = new BN(parseInt(to.timestamp)).sub(new BN(parseInt(seed.timestamp))).abs()

            return {
                price0: new BN(price0CumulativeLast).sub(new BN(seedPrice0CumulativeLast)).div(period),
                price1: new BN(price1CumulativeLast).sub(new BN(seedPrice1CumulativeLast)).div(period),
                blockNumber: seedBlock
            }
        }
        const metadataDecoder = (res) => { return w3.eth.abi.decodeParameters([{ "internalType": "uint256", "name": "dec0", "type": "uint256" }, { "internalType": "uint256", "name": "dec1", "type": "uint256" }, { "internalType": "uint256", "name": "r0", "type": "uint256" }, { "internalType": "uint256", "name": "r1", "type": "uint256" }, { "internalType": "bool", "name": "st", "type": "bool" }, { "internalType": "address", "name": "t0", "type": "address" }, { "internalType": "address", "name": "t1", "type": "address" }], res) }
        const observationLengthDecoder = (res) => { return w3.eth.abi.decodeParameters([{ "internalType": "uint256", "name": "", "type": "uint256" }], res) }
        const sampleDecoder = (res) => { return w3.eth.abi.decodeParameters([{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], res) }
        const getFusePriceSolidly = async (w3, pairAddress, toBlock, seedBlock) => {
            const pair = new w3.eth.Contract(SOLIDLY_PAIR_ABI, pairAddress)
            pair.address = pairAddress

            let [
                metadata,
                observationLength,
                seedObservationLength,
            ] = await this.makeBatchRequest(w3, [
                { req: this.makeEthCallRequest(0, pair, 'metadata', [], toBlock), decoder: metadataDecoder },
                // reqs to get observationLength of toBlock
                { req: this.makeEthCallRequest(1, pair, 'observationLength', [], toBlock), decoder: observationLengthDecoder },
                // reqs to get observationLength of seedBlock 
                { req: this.makeEthCallRequest(2, pair, 'observationLength', [], seedBlock), decoder: observationLengthDecoder },
            ])

            const window = observationLength['0'] - seedObservationLength['0']

            let [price0, price1] = await this.makeBatchRequest(w3, [
                { req: this.makeEthCallRequest(0, pair, 'sample', [metadata.t0, metadata.dec0, 1, window], toBlock), decoder: sampleDecoder },
                { req: this.makeEthCallRequest(1, pair, 'sample', [metadata.t1, metadata.dec1, 1, window], toBlock), decoder: sampleDecoder },
            ])

            return {
                price0: new BN(price0['0'][0]).mul(Q112).div(new BN(metadata.dec0)),
                price1: new BN(price1['0'][0]).mul(Q112).div(new BN(metadata.dec1)),
                blockNumber: seedBlock
            }
        }
        const GET_FUSE_PRICE_FUNCTIONS = {
            UniV2: getFusePriceUniV2,
            Solidly: getFusePriceSolidly,
        }

        return GET_FUSE_PRICE_FUNCTIONS[abiStyle](w3, pairAddress, toBlock, seedBlock)
    },

    checkFusePrice: async function (chainId, pairAddress, price, fusePriceTolerance, blocksToFuse, toBlock, abiStyle) {
        const w3 = networksWeb3[chainId]
        const seedBlock = toBlock - blocksToFuse

        const fusePrice = await this.getFusePrice(w3, pairAddress, toBlock, seedBlock, abiStyle)
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

    calculatePairPrice: async function (chainId, abiStyle, pair, toBlock) {
        const blocksToSeed = networksBlocksPerMinute[chainId] * pair.minutesToSeed
        const blocksToFuse = networksBlocksPerMinute[chainId] * pair.minutesToFuse
        // get seed price
        const seed = await this.getSeed(chainId, pair.address, blocksToSeed, toBlock, abiStyle)
        // get sync events that are emitted after seed block
        const syncEventsMap = await this.getSyncEvents(chainId, seed.blockNumber, pair.address, blocksToSeed, abiStyle)
        // create an array contains a price for each block mined after seed block 
        const prices = this.createPrices(seed, syncEventsMap, blocksToSeed)
        // remove outlier prices
        const { outlierRemoved, removed } = this.removeOutlier(prices)
        // calculate the average price
        const price = this.calculateAveragePrice(outlierRemoved, true)
        // check for high price change in comparison with fuse price
        const fuse = await this.checkFusePrice(chainId, pair.address, price, pair.fusePriceTolerance, blocksToFuse, toBlock, abiStyle)
        if (!(fuse.isOk0 && fuse.isOk1)) throw { message: `High price gap 0(${fuse.priceDiffPercentage0}%) 1(${fuse.priceDiffPercentage1}%) between fuse and twap price for ${pair.address} in block range ${fuse.block} - ${toBlock}` }

        return {
            price0: price.price0,
            price1: price.price1,
            removed
        }
    },
}
