const { axios, BN, toBaseUnit, ethCall, ethGetBlockNumber, Web3 } = MuonAppUtils;
axios.defaults.timeout = 5000;

const scale = new BN(toBaseUnit("1", 18));
const ZERO = new BN(0);
const scaleUp = (value) => new BN(toBaseUnit(String(value), 18));

const ABI = require("./symmio_abi.json");

const UPNL_TOLERANCE = scaleUp("0.001");
const PRICE_TOLERANCE = scaleUp("0.01");
const minusOne = new BN(-1);

const priceSources = ["binance"];

const getSorucePrices = {
    binance: getBinancePrices,
};

async function getBinancePrices() {
    // Define the Binance API URL
    const binanceUrl = "https://fapi.binance.com/fapi/v1/premiumIndex";
    // Make an HTTP GET request to the Binance API using Axios
    const { data } = await axios.get(binanceUrl);
    const pricesMap = {};
    data.forEach((el) => {
    pricesMap[el.symbol] = scaleUp(el.markPrice).toString();
    });
    return pricesMap;
}

async function getBinanceMaxLeverages() {
    const binanceLeveragesUrl = "https://www.binance.com/bapi/futures/v1/friendly/future/common/brackets";

    // Make an HTTP POST request to the Binance API using Axios
    const { data } = await axios.post(binanceLeveragesUrl, {
        headers: {
            accept: "*/*",
            "Content-Type": "application/json",
        },
    });

    const maxLeverages = {};
    const leverageData = data.data.brackets;
    leverageData.forEach((el) => {
        maxLeverages[el.symbol] = el.riskBrackets[0].maxOpenPosLeverage;
    });

    return maxLeverages;
}

function isPriceToleranceOk(price, expectedPrice, priceTolerance) {
    let priceDiff = new BN(price).sub(new BN(expectedPrice)).abs();
    const priceDiffPercentage = new BN(priceDiff).mul(scale).div(new BN(expectedPrice));
    return {
        isOk: !priceDiffPercentage.gt(new BN(priceTolerance)),
        priceDiffPercentage: parseFloat(priceDiffPercentage.mul(new BN(10000)).div(scale).toString()) / 100,
    };
}

function isUpnlToleranceOk(uPnl, expectedUpnl, notionalValueSum, uPnlTolerance) {
    if (new BN(notionalValueSum).eq(ZERO)) return { isOk: new BN(expectedUpnl).eq(ZERO) };

    let uPnlDiff = new BN(uPnl).sub(new BN(expectedUpnl)).abs();
    const uPnlDiffInNotionalValue = uPnlDiff.mul(scale).div(new BN(notionalValueSum));
    return {
        isOk: !uPnlDiffInNotionalValue.gt(new BN(uPnlTolerance)),
        uPnlDiffInNotionalValue: uPnlDiffInNotionalValue.mul(new BN(100)).div(scale),
    };
}

async function getSymbols(quoteIds, chainId, symmio, blockNumber) {
    const symbols = await ethCall(symmio, "symbolNameByQuoteId", [quoteIds], ABI, chainId, blockNumber);
    if (symbols.includes("")) throw { message: "Invalid quoteId" };
    return symbols;
}

function checkPrices(symbols, markPrices, maxLeverages) {
    const expectedPrices = markPrices["binance"];
    if (priceSources.length == 1) return true;
    for (let symbol of symbols) {
        const expectedPrice = expectedPrices[symbol];
        if (expectedPrice == undefined) throw { message: "Undefined Binance Price", symbol };
        let sourcesCount = 0;
        for (let source of priceSources) {
            if (source == "binance") continue;
            const pricesMap = markPrices[source];
            let price = pricesMap[symbol];
            if (price == undefined) {
                continue;
            }
            sourcesCount += 1;
            const priceTolerance = scaleUp(String(1 / maxLeverages[symbol]));
            let priceCheckResult = isPriceToleranceOk(price, expectedPrice, priceTolerance);
            if (!priceCheckResult.isOk) throw { message: "Corrupted Price", symbol, diff: priceCheckResult.priceDiffPercentage };
        }
        if (sourcesCount == 0) throw { message: "Single Source Symbol", symbol };
    }

    return true;
}

async function getPrices(symbols) {
    const promises = [];
    for (let priceSource of priceSources) {
        promises.push(getSorucePrices[priceSource]());
    }
    promises.push(getBinanceMaxLeverages());

    let result;
    try {
        result = await Promise.all(promises);
    } catch (e) {
        console.log(e);
        if (e.message) throw e;
        throw { message: "FAILED_TO_GET_PRICES" };
    }
    const markPrices = {};
    for (let [i, priceSource] of priceSources.entries()) {
        markPrices[priceSource] = result[i];
    }
    const maxLeverages = result[result.length - 1];

    checkPrices(symbols, markPrices, maxLeverages);

    return { pricesMap: markPrices["binance"], markPrices, maxLeverages };
}

async function fetchPrices(quoteIds, chainId, symmio, blockNumber) {
    // Retrieve symbols corresponding to the given quoteIds
    const symbols = await getSymbols(quoteIds, chainId, symmio, blockNumber);

    // Fetch the latest prices and create a prices map
    const { pricesMap, markPrices, maxLeverages } = await getPrices(symbols);

    // Create an array of prices by matching symbols with prices in the map
    const prices = createPricesList(symbols, pricesMap);

    // Return an object containing the prices array and prices map
    return { symbols, prices, pricesMap, markPrices, maxLeverages };
}

function createPricesList(symbols, pricesMap) {
    const prices = [];
    symbols.forEach((symbol) => prices.push(pricesMap[symbol].toString()));
    return prices;
}

async function calculateUpnl(openPositions, prices) {
    let uPnl = new BN(0); // Initializes uPnl to zero
    let loss = new BN(0); // Initializes loss to zero
    let notionalValueSum = new BN(0); // Initializes notionalValueSum to zero

    // Iterates through each open position
    for (let [i, position] of openPositions.entries()) {
        const openedPrice = new BN(position.openedPrice); // Retrieves the opened price of the position
        const priceDiff = new BN(prices[i]).sub(openedPrice); // Calculates the price difference between the current price and the opened price
        const amount = new BN(position.quantity).sub(new BN(position.closedAmount)); // Calculates the remaining amount of the position

        // Calculates the uPnl for the current position based on the position type (long or short)
        const longPositionUpnl = amount.mul(priceDiff);
        const positionUpnl = position.positionType == "0" ? longPositionUpnl : minusOne.mul(longPositionUpnl);

        // Adds the position's uPnl to the total uPnl after scaling it
        uPnl = uPnl.add(positionUpnl.div(scale));
        // Add the position's uPnl to the total loss if it is negative
        if (positionUpnl.isNeg()) loss = loss.add(positionUpnl.div(scale));

        // Calculates the notional value of the position and adds it to the total notional value sum
        const positionNotionalValue = amount.mul(openedPrice).div(scale);
        notionalValueSum = notionalValueSum.add(positionNotionalValue);
    }

    // Returns the calculated uPnl and notional value sum
    return { uPnl, loss, notionalValueSum };
}

async function getPositionsCount(parties, side, chainId, symmio, blockNumber) {
    if (side == "A") return await ethCall(symmio, "partyAPositionsCount", [parties.partyA], ABI, chainId, blockNumber);
    else if (side == "B") return await ethCall(symmio, "partyBPositionsCount", [parties.partyB, parties.partyA], ABI, chainId, blockNumber);
}

async function getOpenPositions(parties, side, start, size, chainId, symmio, blockNumber) {
    if (side == "A") return await ethCall(symmio, "getPartyAOpenPositions", [parties.partyA, start, size], ABI, chainId, blockNumber);
    else if (side == "B")
        return await ethCall(symmio, "getPartyBOpenPositions", [parties.partyB, parties.partyA, start, size], ABI, chainId, blockNumber);
}

async function fetchOpenPositions(parties, side, chainId, symmio, blockNumber) {
    const positionsCount = new BN(await getPositionsCount(parties, side, chainId, symmio, blockNumber));
    if (positionsCount.eq(new BN(0))) return { openPositions: [], quoteIds: [] };

    const size = 50;
    const getsCount = parseInt(positionsCount.div(new BN(size))) + 1;

    const openPositions = [];
    for (let i = 0; i < getsCount; i++) {
        const start = i * size;
        openPositions.push(...(await getOpenPositions(parties, side, start, size, chainId, symmio)));
    }

    let quoteIds = [];
    let symbolIds = new Set();
    let partyBs = new Set();
    openPositions.forEach((position) => {
        quoteIds.push(String(position.id));
        symbolIds.add(String(position.symbolId));
        partyBs.add(position.partyB);
    });

    symbolIds = Array.from(symbolIds);
    partyBs = Array.from(partyBs);

    return {
        openPositions,
        quoteIds,
        symbolIds,
        partyBs,
    };
}

function filterPositions(partyB, mixedOpenPositions) {
    let quoteIds = [];
    let openPositions = [];
    mixedOpenPositions.forEach((position) => {
        if (position.partyB == partyB) {
            openPositions.push(position);
            quoteIds.push(String(position.id));
        }
    });
    return { openPositions, quoteIds };
}

async function fetchPartyBsAllocateds(chainId, symmio, partyA, partyBs, blockNumber) {
    const allocateds = await ethCall(symmio, "allocatedBalanceOfPartyBs", [partyA, partyBs], ABI, chainId, blockNumber);
    return allocateds;
}

async function getPartyNonce(parties, side, symmio, chainId, blockNumber) {
    let nonce;
    if (side == "A") nonce = String(await ethCall(symmio, "nonceOfPartyA", [parties.partyA], ABI, chainId, blockNumber));
    else if (side == "B") nonce = String(await ethCall(symmio, "nonceOfPartyB", [parties.partyB, parties.partyA], ABI, chainId, blockNumber));
    return nonce;
}

async function uPnlPartyA(partyA, chainId, symmio, blockNumber) {
    // Fetches the open positions and quote IDs for partyA
    const { openPositions, quoteIds, symbolIds, partyBs } = await fetchOpenPositions({ partyA }, "A", chainId, symmio, blockNumber);

    // Retrieves the nonce of partyA
    const nonce = await getPartyNonce({ partyA }, "A", symmio, chainId, blockNumber);

    // If there are no open positions, return the result with zero uPnl, notional value sum,
    // nonce, quote IDs, open positions, prices map and mark prices (retrieved using the getPrices function)
    if (openPositions.length == 0) {
        const { pricesMap, markPrices, maxLeverages } = await getPrices([]);
        return {
            uPnl: ZERO.toString(),
            loss: ZERO.toString(),
            notionalValueSum: ZERO.toString(),
            nonce,
            quoteIds,
            symbolIds: [],
            symbolIdsPrices: [],
            prices: [],
            openPositions,
            pricesMap,
            markPrices,
            maxLeverages,
        };
    }

    // Fetches the prices, prices map and mark prices for the quote IDs
    const { symbols, prices, pricesMap, markPrices, maxLeverages } = await fetchPrices(quoteIds, chainId, symmio, blockNumber);

    // Calculates the uPnl and notional value sum using the open positions and prices
    const partyBsAllocateds = await fetchPartyBsAllocateds(chainId, symmio, partyA, partyBs, blockNumber);
    let [uPnl, loss, notionalValueSum] = [ZERO, ZERO, ZERO];
    for (let [i, partyB] of partyBs.entries()) {
        const openPositionsPerPartyB = openPositions.filter((position) => position.partyB == partyB);
        const pricesPerPartyB = prices.filter((price, index) => openPositionsPerPartyB.includes(openPositions[index]));
        const {
            uPnl: uPnlPerPartyB,
            loss: lossPerPartyB,
            notionalValueSum: notionalValueSumPerPartyB,
        } = await calculateUpnl(openPositionsPerPartyB, pricesPerPartyB);
        uPnl = uPnl.add(BN.min(uPnlPerPartyB, new BN(partyBsAllocateds[i])));
        loss = loss.add(lossPerPartyB);
        notionalValueSum = notionalValueSum.add(notionalValueSumPerPartyB);
    }

    // Returns the result with the calculated uPnl, notional value sum, nonce, prices map,
    // prices, quote IDs, open positions and mark prices
    return {
        uPnl: uPnl.toString(),
        loss: loss.toString(),
        notionalValueSum: notionalValueSum.toString(),
        nonce,
        pricesMap,
        symbolIds,
        symbols,
        symbolIdsPrices: Array.from(new Set(prices)),
        prices,
        quoteIds,
        openPositions,
        markPrices,
        maxLeverages,
    };
}

async function uPnlPartyB(partyB, partyA, chainId, symmio, blockNumber) {
    // Fetches the open positions and quote IDs for partyB with the associated partyA
    const { openPositions, quoteIds } = await fetchOpenPositions({ partyB, partyA }, "B", chainId, symmio, blockNumber);

    // Retrieves the nonce of partyB for the given partyA
    const nonce = await getPartyNonce({ partyB, partyA }, "B", symmio, chainId, blockNumber);

    // If there are no open positions, return the result with zero uPnl, notional value sum,
    // nonce, and quote IDs
    if (openPositions.length == 0) {
        return {
            uPnl: ZERO.toString(),
            notionalValueSum: ZERO.toString(),
            nonce,
            quoteIds,
        };
    }

    // Fetches the prices and prices map for the quote IDs
    const { prices, pricesMap, markPrices } = await fetchPrices(quoteIds, chainId, symmio, blockNumber);

    // Calculates the uPnl and notional value sum using the open positions and prices
    const { uPnl, notionalValueSum } = await calculateUpnl(openPositions, prices);

    // Returns the result with the calculated uPnl (multiplied by -1 to represent partyB's perspective),
    // notional value sum, nonce, prices map, prices, and quote IDs
    return {
        uPnl: minusOne.mul(uPnl).toString(),
        notionalValueSum: notionalValueSum.toString(),
        nonce,
        pricesMap,
        prices,
        quoteIds,
        markPrices,
    };
}

async function uPnlPartyB_FetchedData(partyB, partyA, chainId, pricesMap, mixedOpenPositions, symmio, blockNumber) {
    // Filters the mixed open positions to only include positions associated with partyB
    const { openPositions, quoteIds } = filterPositions(partyB, mixedOpenPositions);

    let uPnl, notionalValueSum, prices;

    if (openPositions.length > 0) {
        // Retrieves the symbols associated with the quote IDs
        const symbols = await getSymbols(quoteIds, chainId, symmio, blockNumber);

        // Creates a prices list using the symbols and prices map
        prices = createPricesList(symbols, pricesMap);

        // Calculates the uPnl and notional value sum using the open positions and prices
        const result = await calculateUpnl(openPositions, prices);
        uPnl = result.uPnl;
        notionalValueSum = result.notionalValueSum;
    } else {
        // If there are no open positions, set uPnl and notional value sum to zero
        uPnl = notionalValueSum = new BN(0);
        prices = [];
    }

    // Retrieves the nonce of partyB for the given partyA
    const nonce = await getPartyNonce({ partyB, partyA }, "B", symmio, chainId, blockNumber);

    // Returns the result with the calculated uPnl, notional value sum, nonce, prices, and quote IDs
    return {
        uPnl,
        notionalValueSum,
        nonce,
        prices,
        quoteIds,
    };
}

async function uPnlParties(partyB, partyA, chainId, symmio, blockNumber) {
    // Checks if partyB and partyA are identical, and throws an error if they are
    if (partyB == partyA) {
        throw { message: "Identical Parties Error" };
    }

    // Calculates the uPnl, nonce, notional value sum, prices map, prices, mark prices and quote IDs for partyA
    const {
        uPnl: uPnlA,
        nonce: nonceA,
        notionalValueSum: notionalValueSumA,
        pricesMap,
        markPrices,
        prices: pricesA,
        quoteIds: quoteIdsA,
        openPositions,
        maxLeverages,
    } = await uPnlPartyA(partyA, chainId, symmio, blockNumber);

    // Calculates the uPnl, nonce, notional value sum, prices, and quote IDs for partyB using fetched data
    const {
        uPnl: uPnlB,
        nonce: nonceB,
        notionalValueSum: notionalValueSumB,
        prices: pricesB,
        quoteIds: quoteIdsB,
    } = await uPnlPartyB_FetchedData(partyB, partyA, chainId, pricesMap, openPositions, symmio, blockNumber);

    // Returns the results with adjusted uPnl for partyB, uPnl for partyA, notional value sum for partyB and partyA,
    // nonces for partyB and partyA, prices map, mark prices, prices for partyB and partyA, and quote IDs for partyB and partyA
    return {
        uPnlB: minusOne.mul(uPnlB).toString(),
        uPnlA,
        notionalValueSumB: notionalValueSumB.toString(),
        notionalValueSumA,
        nonceB,
        nonceA,
        pricesMap,
        maxLeverages,
        markPrices,
        pricesB,
        pricesA,
        quoteIdsB,
        quoteIdsA,
    };
}

async function getSymbolsByIds(symmio, symbolIds, chainId, blockNumber = "latest") {
    const symbols = await ethCall(symmio, "symbolNameById", [symbolIds], ABI, chainId, blockNumber);
    return symbols;
}

async function getSymbolPrice(symbolId, pricesMap, markPrices, maxLeverages, symmio, chainId, blockNumber) {
    const [symbol] = await getSymbolsByIds(symmio, [symbolId], chainId, blockNumber);
    let price = pricesMap[symbol];
    if (price == undefined) throw { message: "Invalid symbol" };
    checkPrices([symbol], markPrices, maxLeverages);
    return price;
}

async function getCandles(symbol, t0, t1) {
    const klinesUrl = "https://fapi.binance.com/fapi/v1/klines";
    const rangeInMinutes = parseInt((t1 - t0) / 60) + 1;
    const params = {
        symbol,
        interval: "1m",
        limit: rangeInMinutes,
        startTime: t0 * 1000,
        endTime: t1 * 1000,
    };

    let candles;
    try {
        const { data } = await axios.get(klinesUrl, { params });
        candles = data;
        if (candles.length != rangeInMinutes) throw { message: "INVALID_CANDLES_LENGTH" };
    } catch (e) {
        console.log(e);
        throw { message: e.message ? e.message : "ERROR_IN_GET_CANDLES" };
    }
    return candles;
}

function parseCandles(candles) {
    let [lowest, highest] = [candles[0][3], candles[0][2]];
    let sum = 0;
    let volumeSum = 0;
    candles.forEach((candle) => {
        let high = candle[2];
        let low = candle[3];
        let close = candle[4];
        let volume = candle[5];

        // set lowest & highest
        if (low < lowest) lowest = low;
        if (high > highest) highest = high;

        // mean = sigma(close * volume) / sigma(volume)
        sum += close * volume;
        volumeSum += parseFloat(volume);
    });
    let startTime = parseInt(candles[0][0] / 1000);
    let endTime = parseInt(candles[candles.length - 1][0] / 1000);

    lowest = scaleUp(lowest);
    if (lowest.eq(new BN(0))) throw { message: "ZERO_LOWEST" };

    let mean = sum / volumeSum;

    return {
        lowest: lowest.toString(),
        highest: scaleUp(highest).toString(),
        mean: scaleUp(String(mean)).toString(),
        startTime,
        endTime,
    };
}

async function getPriceRange(symmio, symbolId, t0, t1, chainId) {
    const [symbol] = await getSymbolsByIds(symmio, [symbolId], chainId);
    const candles = await getCandles(symbol, t0, t1);
    const { lowest, highest, mean, startTime, endTime } = parseCandles(candles);
    if (startTime != t0 || endTime != t1) throw { message: "BAD_BINANCE_RESPONSE" };
    return { lowest, highest, mean, startTime, endTime };
}

module.exports = {
    APP_NAME: "symmio",
    useFrost: true,
    
    onRequest: async function (request) {
        let {
            method,
            data: { params },
        } = request;

        let latestBlockNumber = request.data.result ? request.data.result.latestBlockNumber : String(await ethGetBlockNumber(params.chainId));

        switch (method) {
            case "uPnl_A":
            case "partyA_overview": {
                let { partyA, chainId, symmio } = params;
                const result = await uPnlPartyA(partyA, chainId, symmio, latestBlockNumber);
                delete result.openPositions;
                let liquidationId;
                if (request.data.result) {
                    liquidationId = request.data.result.liquidationId;
                } else {
                    liquidationId = new Web3().eth.accounts.create().privateKey;
                }
                return Object.assign({}, { chainId, partyA, symmio, liquidationId, latestBlockNumber }, result);
            }

            case "verify": {
                let {
                    deploymentSeed,
                    signature,
                    reqId,
                    nonceAddress,
                    start,
                    size,
                    liquidationId,
                    symmio,
                    partyA,
                    nonce,
                    uPnl,
                    loss,
                    symbolIds,
                    prices,
                    timestamp,
                    chainId,
                } = params;
                start = parseInt(start);
                size = parseInt(size);
                symbolIds = JSON.parse(symbolIds);
                symbolIds = symbolIds.map((symbolId) => String(symbolId));
                prices = JSON.parse(prices);
                prices = prices.map((price) => String(price));
                const signedParams = [
                    { name: "appId", type: "uint256", value: request.appId },
                    { name: "reqId", type: "bytes", value: reqId },
                    { type: "bytes", value: liquidationId },
                    { type: "address", value: symmio },
                    { type: "string", value: "verifyLiquidationSig" },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonce },
                    { type: "int256", value: uPnl },
                    { type: "int256", value: loss },
                    { type: "uint256[]", value: symbolIds },
                    { type: "uint256[]", value: prices },
                    { type: "uint256", value: timestamp },
                    { type: "uint256", value: chainId },
                ];
                const hash = this.hashAppSignParams(seedRequest, signedParams);
                if (!(await this.verify(deploymentSeed, hash, signature, nonceAddress))) throw { message: `Signature Not Verified` };

                return {
                    liquidationId,
                    symmio,
                    partyA,
                    nonce,
                    uPnl,
                    loss,
                    symbolIds: symbolIds.slice(start, start + size),
                    prices: prices.slice(start, start + size),
                    timestamp,
                    chainId,
                };
            }

            case "uPnl_A_withSymbolPrice": {
                let { partyA, chainId, symbolId, symmio } = params;
                const result = await uPnlPartyA(partyA, chainId, symmio, latestBlockNumber);
                const price = await getSymbolPrice(
                    symbolId,
                    result.pricesMap,
                    result.markPrices,
                    result.maxLeverages,
                    symmio,
                    chainId,
                    latestBlockNumber
                );
                delete result.openPositions;
                return Object.assign({}, { chainId, partyA, symbolId, price, symmio, latestBlockNumber }, result);
            }

            case "uPnl_B": {
                let { partyB, partyA, chainId, symmio } = params;
                const result = await uPnlPartyB(partyB, partyA, chainId, symmio, latestBlockNumber);
                return Object.assign({}, { chainId, partyB, partyA, symmio, latestBlockNumber }, result);
            }

            case "uPnl": {
                let { partyB, partyA, chainId, symmio } = params;
                const result = await uPnlParties(partyB, partyA, chainId, symmio, latestBlockNumber);
                return Object.assign({}, { chainId, partyB, partyA, symmio, latestBlockNumber }, result);
            }

            case "uPnlWithSymbolPrice": {
                let { partyB, partyA, chainId, symbolId, symmio } = params;
                const result = await uPnlParties(partyB, partyA, chainId, symmio, latestBlockNumber);
                const price = await getSymbolPrice(
                    symbolId,
                    result.pricesMap,
                    result.markPrices,
                    result.maxLeverages,
                    symmio,
                    chainId,
                    latestBlockNumber
                );
                return Object.assign({}, { chainId, partyB, partyA, symbolId, price, symmio, latestBlockNumber }, result);
            }

            case "price": {
                let { quoteIds, chainId, symmio } = params;

                quoteIds = JSON.parse(quoteIds);
                const result = await fetchPrices(quoteIds, chainId, symmio, latestBlockNumber);
                return Object.assign({}, { chainId, quoteIds, symmio, latestBlockNumber }, result);
            }

            case "priceRange": {
                let { symmio, partyA, partyB, symbolId, t0, t1, chainId } = params;

                t0 = parseInt(t0);
                t1 = parseInt(t1);

                if (t0 % 60 != 0 || t1 % 60 != 0) throw { message: "BAD_START_OR_END_TIME" };
                if (t0 >= t1) throw { message: "START_AFTER_END_TIME" };

                const { lowest, highest, mean, startTime, endTime } = await getPriceRange(symmio, symbolId, t0, t1, chainId);
                const result = await uPnlParties(partyB, partyA, chainId, symmio, latestBlockNumber);
                const price = await getSymbolPrice(
                    symbolId,
                    result.pricesMap,
                    result.markPrices,
                    result.maxLeverages,
                    symmio,
                    chainId,
                    latestBlockNumber
                );
                return Object.assign(
                    {},
                    { chainId, partyB, partyA, symmio, symbolId, startTime, endTime, lowest, highest, mean, price, latestBlockNumber },
                    result
                );
            }

            default:
                throw { message: `Unknown method ${method}` };
        }
    },

    /**
     * List of the parameters that need to be signed.
     * APP_ID, reqId will be added by the
     * Muon Core and [APP_ID, reqId, … signParams]
     * should be verified on chain.
     */
    signParams: function (request, result) {
        let { method } = request;
        switch (method) {
            case "uPnl_A": {
                let { partyA, uPnl, notionalValueSum, nonce, chainId, symmio } = result;

                if (!isUpnlToleranceOk(uPnl, request.data.result.uPnl, notionalValueSum, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };

                return [
                    { type: "address", value: symmio },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonce },
                    { type: "int256", value: request.data.result.uPnl },
                    { type: "uint256", value: request.data.timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            case "partyA_overview": {
                let { partyA, uPnl, loss, symbolIds, notionalValueSum, nonce, chainId, symmio, liquidationId } = result;

                if (!isUpnlToleranceOk(uPnl, request.data.result.uPnl, notionalValueSum, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };
                if (!isUpnlToleranceOk(loss, request.data.result.loss, notionalValueSum, UPNL_TOLERANCE).isOk)
                    throw { message: "Loss Tolerance Error" };

                return [
                    { type: "bytes", value: liquidationId },
                    { type: "address", value: symmio },
                    { type: "string", value: "verifyLiquidationSig" },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonce },
                    { type: "int256", value: request.data.result.uPnl },
                    { type: "int256", value: request.data.result.loss },
                    { type: "uint256[]", value: symbolIds },
                    { type: "uint256[]", value: request.data.result.symbolIdsPrices },
                    { type: "uint256", value: request.data.timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            case "verify": {
                let { liquidationId, partyA, nonce, uPnl, loss, symbolIds, prices, timestamp, chainId, symmio } = result;

                return [
                    { type: "bytes", value: liquidationId },
                    { type: "address", value: symmio },
                    { type: "string", value: "verifyLiquidationSig" },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonce },
                    { type: "int256", value: uPnl },
                    { type: "int256", value: loss },
                    { type: "uint256[]", value: symbolIds },
                    { type: "uint256[]", value: prices },
                    { type: "uint256", value: timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            case "uPnl_A_withSymbolPrice": {
                let { partyA, uPnl, symbolId, price, notionalValueSum, nonce, chainId, symmio } = result;

                if (!isUpnlToleranceOk(uPnl, request.data.result.uPnl, notionalValueSum, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };
                if (!isPriceToleranceOk(price, request.data.result.price, PRICE_TOLERANCE).isOk) throw { message: `Price Tolerance Error` };

                return [
                    { type: "address", value: symmio },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonce },
                    { type: "int256", value: request.data.result.uPnl },
                    { type: "uint256", value: symbolId },
                    { type: "uint256", value: request.data.result.price },
                    { type: "uint256", value: request.data.timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            case "uPnl_B": {
                let { partyB, partyA, uPnl, notionalValueSum, nonce, chainId, symmio } = result;

                if (!isUpnlToleranceOk(uPnl, request.data.result.uPnl, notionalValueSum, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };

                return [
                    { type: "address", value: symmio },
                    { type: "address", value: partyB },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonce },
                    { type: "int256", value: request.data.result.uPnl },
                    { type: "uint256", value: request.data.timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            case "uPnl": {
                let { partyB, partyA, uPnlB, uPnlA, notionalValueSumB, notionalValueSumA, nonceB, nonceA, chainId, symmio } = result;

                if (!isUpnlToleranceOk(uPnlB, request.data.result.uPnlB, notionalValueSumB, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };
                if (!isUpnlToleranceOk(uPnlA, request.data.result.uPnlA, notionalValueSumA, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };

                return [
                    { type: "address", value: symmio },
                    { type: "address", value: partyB },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonceB },
                    { type: "uint256", value: nonceA },
                    { type: "int256", value: request.data.result.uPnlB },
                    { type: "int256", value: request.data.result.uPnlA },
                    { type: "uint256", value: request.data.timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            case "uPnlWithSymbolPrice": {
                let { partyB, partyA, uPnlB, uPnlA, symbolId, price, notionalValueSumB, notionalValueSumA, nonceB, nonceA, chainId, symmio } = result;

                if (!isUpnlToleranceOk(uPnlB, request.data.result.uPnlB, notionalValueSumB, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };
                if (!isUpnlToleranceOk(uPnlA, request.data.result.uPnlA, notionalValueSumA, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };
                if (!isPriceToleranceOk(price, request.data.result.price, PRICE_TOLERANCE).isOk) throw { message: `Price Tolerance Error` };

                return [
                    { type: "address", value: symmio },
                    { type: "address", value: partyB },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonceB },
                    { type: "uint256", value: nonceA },
                    { type: "int256", value: request.data.result.uPnlB },
                    { type: "int256", value: request.data.result.uPnlA },
                    { type: "uint256", value: symbolId },
                    { type: "uint256", value: request.data.result.price },
                    { type: "uint256", value: request.data.timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            case "price": {
                let { quoteIds, prices, chainId, symmio } = result;

                for (let [i, price] of prices.entries()) {
                    if (!isPriceToleranceOk(price, request.data.result.prices[i], PRICE_TOLERANCE).isOk) throw { message: `Price Tolerance Error` };
                }

                return [
                    { type: "address", value: symmio },
                    { type: "uint256[]", value: quoteIds },
                    { type: "uint256[]", value: request.data.result.prices },
                    { type: "uint256", value: request.data.timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            case "priceRange": {
                let {
                    partyB,
                    partyA,
                    uPnlB,
                    uPnlA,
                    notionalValueSumB,
                    notionalValueSumA,
                    nonceB,
                    nonceA,
                    symbolId,
                    price,
                    startTime,
                    endTime,
                    lowest,
                    highest,
                    mean,
                    symmio,
                    chainId,
                } = result;

                if (!isUpnlToleranceOk(uPnlB, request.data.result.uPnlB, notionalValueSumB, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };
                if (!isUpnlToleranceOk(uPnlA, request.data.result.uPnlA, notionalValueSumA, UPNL_TOLERANCE).isOk)
                    throw { message: "uPnl Tolerance Error" };
                if (!isPriceToleranceOk(price, request.data.result.price, PRICE_TOLERANCE).isOk) throw { message: `Price Tolerance Error` };

                return [
                    { type: "address", value: symmio },
                    { type: "address", value: partyB },
                    { type: "address", value: partyA },
                    { type: "uint256", value: nonceB },
                    { type: "uint256", value: nonceA },
                    { type: "int256", value: request.data.result.uPnlB },
                    { type: "int256", value: request.data.result.uPnlA },
                    { type: "uint256", value: symbolId },
                    { type: "uint256", value: request.data.result.price },
                    { type: "uint256", value: startTime },
                    { type: "uint256", value: endTime },
                    { type: "uint256", value: lowest },
                    { type: "uint256", value: highest },
                    { type: "uint256", value: mean },
                    { type: "uint256", value: request.data.timestamp },
                    { type: "uint256", value: chainId },
                ];
            }

            default:
                break;
        }
    },
};
