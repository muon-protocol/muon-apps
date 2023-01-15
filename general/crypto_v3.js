const { axios, BN, toBaseUnit, ethCall } = MuonAppUtils
const ETH = new BN(toBaseUnit('1', 18))
const scaleUp = (value) => new BN(toBaseUnit(String(value), 18))

const ABI = [{ "inputs": [{ "internalType": "uint256[]", "name": "quoteIds", "type": "uint256[]" }], "name": "symbolNameByQuoteId", "outputs": [{ "internalType": "string[]", "name": "", "type": "string[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "partyA", "type": "address" }], "name": "nonceOfPartyA", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "partyB", "type": "address" }, { "internalType": "address", "name": "partyA", "type": "address" }], "name": "nonceOfPartyB", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "partyA", "type": "address" }], "name": "partyAPositionsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "partyB", "type": "address" }, { "internalType": "address", "name": "partyA", "type": "address" }], "name": "partyBPositionsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "partyA", "type": "address" }, { "internalType": "uint256", "name": "start", "type": "uint256" }, { "internalType": "uint256", "name": "size", "type": "uint256" }], "name": "getPartyAOpenPositions", "outputs": [{ "components": [{ "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "address[]", "name": "partyBsWhiteList", "type": "address[]" }, { "internalType": "uint256", "name": "symbolId", "type": "uint256" }, { "internalType": "enum PositionType", "name": "positionType", "type": "uint8" }, { "internalType": "uint256", "name": "openedPrice", "type": "uint256" }, { "internalType": "uint256", "name": "requestedOpenLimitPrice", "type": "uint256" }, { "internalType": "uint256", "name": "openSlippage", "type": "uint256" }, { "internalType": "uint256", "name": "closeSlippage", "type": "uint256" }, { "internalType": "uint256", "name": "quantity", "type": "uint256" }, { "internalType": "uint256", "name": "closedAmount", "type": "uint256" }, { "components": [{ "internalType": "uint256", "name": "cva", "type": "uint256" }, { "internalType": "uint256", "name": "mm", "type": "uint256" }, { "internalType": "uint256", "name": "lf", "type": "uint256" }], "internalType": "struct LockedValues", "name": "lockedValues", "type": "tuple" }, { "internalType": "uint256", "name": "maxInterestRate", "type": "uint256" }, { "internalType": "address", "name": "partyA", "type": "address" }, { "internalType": "address", "name": "partyB", "type": "address" }, { "internalType": "enum QuoteStatus", "name": "quoteStatus", "type": "uint8" }, { "internalType": "uint256", "name": "avgClosedPrice", "type": "uint256" }, { "internalType": "uint256", "name": "requestedCloseLimitPrice", "type": "uint256" }, { "internalType": "uint256", "name": "quantityToClose", "type": "uint256" }, { "internalType": "uint256", "name": "parentId", "type": "uint256" }, { "internalType": "uint256", "name": "createTimestamp", "type": "uint256" }, { "internalType": "uint256", "name": "modifyTimestamp", "type": "uint256" }], "internalType": "struct Quote[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "partyB", "type": "address" }, { "internalType": "address", "name": "partyA", "type": "address" }, { "internalType": "uint256", "name": "start", "type": "uint256" }, { "internalType": "uint256", "name": "size", "type": "uint256" }], "name": "getPartyBOpenPositions", "outputs": [{ "components": [{ "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "address[]", "name": "partyBsWhiteList", "type": "address[]" }, { "internalType": "uint256", "name": "symbolId", "type": "uint256" }, { "internalType": "enum PositionType", "name": "positionType", "type": "uint8" }, { "internalType": "uint256", "name": "openedPrice", "type": "uint256" }, { "internalType": "uint256", "name": "requestedOpenLimitPrice", "type": "uint256" }, { "internalType": "uint256", "name": "openSlippage", "type": "uint256" }, { "internalType": "uint256", "name": "closeSlippage", "type": "uint256" }, { "internalType": "uint256", "name": "quantity", "type": "uint256" }, { "internalType": "uint256", "name": "closedAmount", "type": "uint256" }, { "components": [{ "internalType": "uint256", "name": "cva", "type": "uint256" }, { "internalType": "uint256", "name": "mm", "type": "uint256" }, { "internalType": "uint256", "name": "lf", "type": "uint256" }], "internalType": "struct LockedValues", "name": "lockedValues", "type": "tuple" }, { "internalType": "uint256", "name": "maxInterestRate", "type": "uint256" }, { "internalType": "address", "name": "partyA", "type": "address" }, { "internalType": "address", "name": "partyB", "type": "address" }, { "internalType": "enum QuoteStatus", "name": "quoteStatus", "type": "uint8" }, { "internalType": "uint256", "name": "avgClosedPrice", "type": "uint256" }, { "internalType": "uint256", "name": "requestedCloseLimitPrice", "type": "uint256" }, { "internalType": "uint256", "name": "quantityToClose", "type": "uint256" }, { "internalType": "uint256", "name": "parentId", "type": "uint256" }, { "internalType": "uint256", "name": "createTimestamp", "type": "uint256" }, { "internalType": "uint256", "name": "modifyTimestamp", "type": "uint256" }], "internalType": "struct Quote[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }]
const v3Contract = "0xd966Dd36DdCE09F09f7141E93B78C8edb3a3c3CB"
const UPNL_TOLERANCE = scaleUp('0.001')
const PRICE_TOLERANCE = scaleUp('0.001')
const minusOne = new BN(-1)

module.exports = {
    APP_NAME: 'crypto_v3',

    isPriceToleranceOk: function (price, expectedPrice, priceTolerance) {
        let priceDiff = new BN(price).sub(new BN(expectedPrice)).abs()
        const priceDiffPercentage = new BN(priceDiff).mul(ETH).div(new BN(expectedPrice))
        return {
            isOk: !priceDiffPercentage.gt(new BN(priceTolerance)),
            priceDiffPercentage: priceDiffPercentage.mul(new BN(100)).div(ETH)
        }
    },

    isUpnlToleranceOk: function (uPnl, expectedUpnl, notionalValueSum, uPnlTolerance) {
        let uPnlDiff = new BN(uPnl).sub(new BN(expectedUpnl)).abs()
        const uPnlDiffInNotionalValue = uPnlDiff.mul(ETH).div(new BN(notionalValueSum))
        return {
            isOk: !uPnlDiffInNotionalValue.gt(new BN(uPnlTolerance)),
            uPnlDiffInNotionalValue: uPnlDiffInNotionalValue.mul(new BN(100)).div(ETH)
        }
    },

    getSymbols: async function (quoteIds, chainId) {
        const symbols = await ethCall(v3Contract, 'symbolNameByQuoteId', [quoteIds], ABI, chainId)
        if (symbols.includes('')) throw { message: 'Invalid quoteId' }
        return symbols
    },

    getPrices: async function (symbols) {
        const binanceUrl = 'https://fapi.binance.com/fapi/v1/premiumIndex'
        const { data } = await axios.get(binanceUrl)
        const pricesMap = {}
        data.forEach((el) => {
            if (symbols.includes(el.symbol))
                pricesMap[el.symbol] = scaleUp(el.markPrice).toString()
        })
        return pricesMap
    },

    fetchPrices: async function (quoteIds, chainId) {
        const symbols = await this.getSymbols(quoteIds, chainId)
        const pricesMap = await this.getPrices(symbols)
        const prices = this.createPricesList(symbols, pricesMap)
        return { prices, pricesMap }
    },

    createPricesList: function (symbols, pricesMap) {
        const prices = []
        symbols.forEach((symbol) => prices.push(pricesMap[symbol].toString()))
        return prices
    },

    calculateUpnl: async function (openPositions, prices) {
        let uPnl = new BN(0)
        let notionalValueSum = new BN(0)
        for (let [i, position] of openPositions.entries()) {
            const openedPrice = new BN(position.openedPrice)
            const priceDiff = new BN(prices[i]).sub(openedPrice)
            const amount = new BN(position.quantity).sub(new BN(position.closedAmount))
            const longPositionUpnl = amount.mul(priceDiff)
            const positionUpnl = position.positionType == '0' ? longPositionUpnl : minusOne.mul(longPositionUpnl)
            uPnl = uPnl.add(positionUpnl.div(ETH))
            const positionNotionalValue = amount.mul(openedPrice).div(ETH)
            notionalValueSum = notionalValueSum.add(positionNotionalValue)
        }
        return { uPnl, notionalValueSum }
    },

    getPositionsCount: async function (parties, side, chainId) {
        if (side == 'A') return await ethCall(v3Contract, 'partyAPositionsCount', [parties.partyA], ABI, chainId)
        else if (side == 'B') return await ethCall(v3Contract, 'partyBPositionsCount', [parties.partyB, parties.partyA], ABI, chainId)
    },

    getOpenPositions: async function (parties, side, start, size, chainId) {
        if (side == 'A') return await ethCall(v3Contract, 'getPartyAOpenPositions', [parties.partyA, start, size], ABI, chainId)
        else if (side == 'B') return await ethCall(v3Contract, 'getPartyBOpenPositions', [parties.partyB, parties.partyA, start, size], ABI, chainId)
    },

    fetchOpenPositions: async function (parties, side, chainId) {
        const positionsCount = new BN(await this.getPositionsCount(parties, side, chainId))
        if (positionsCount.eq(new BN(0))) throw { message: 'No open postions' }

        const size = 50
        const getsCount = parseInt(positionsCount.div(new BN(size))) + 1

        const openPositions = []
        for (let i = 0; i < getsCount; i++) {
            const start = i * size
            openPositions.push(...await this.getOpenPositions(parties, side, start, size, chainId))
        }

        let quoteIds = []
        openPositions.forEach((position) => quoteIds.push(position.id))

        return { openPositions, quoteIds }
    },

    uPnlPartyA: async function (partyA, chainId) {
        const { openPositions, quoteIds } = await this.fetchOpenPositions({ partyA }, 'A', chainId)
        const { prices, pricesMap } = await this.fetchPrices(quoteIds, chainId)
        const { uPnl, notionalValueSum } = await this.calculateUpnl(openPositions, prices)
        const nonce = await ethCall(v3Contract, 'nonceOfPartyA', [partyA], ABI, chainId)

        return { uPnl: uPnl.toString(), notionalValueSum: notionalValueSum.toString(), nonce, pricesMap, prices, quoteIds }
    },

    uPnlPartyB: async function (partyB, partyA, chainId) {
        const { openPositions, quoteIds } = await this.fetchOpenPositions({ partyB, partyA }, 'B', chainId)
        const { prices, pricesMap } = await this.fetchPrices(quoteIds, chainId)
        const { uPnl, notionalValueSum } = await this.calculateUpnl(openPositions, prices)
        const nonce = await ethCall(v3Contract, 'nonceOfPartyB', [partyB, partyA], ABI, chainId)

        return { uPnl: minusOne.mul(uPnl).toString(), notionalValueSum: notionalValueSum.toString(), nonce, pricesMap, prices, quoteIds }
    },

    uPnlPartyB_FetchedPrices: async function (partyB, partyA, chainId, pricesMap) {
        const { openPositions, quoteIds } = await this.fetchOpenPositions({ partyB, partyA }, 'B', chainId)
        const symbols = await this.getSymbols(quoteIds, chainId)
        const prices = this.createPricesList(symbols, pricesMap)
        const { uPnl, notionalValueSum } = await this.calculateUpnl(openPositions, prices)
        const nonce = await ethCall(v3Contract, 'nonceOfPartyB', [partyB, partyA], ABI, chainId)

        return { uPnl, notionalValueSum, nonce, prices, quoteIds }
    },

    uPnlParties: async function (partyB, partyA, chainId) {
        const { uPnl: uPnlA, nonce: nonceA, notionalValueSum: notionalValueSumA, pricesMap, prices: pricesA, quoteIds: quoteIdsA } = await this.uPnlPartyA(partyA, chainId)
        const { uPnl: uPnlB, nonce: nonceB, notionalValueSum: notionalValueSumB, prices: pricesB, quoteIds: quoteIdsB } = await this.uPnlPartyB_FetchedPrices(partyB, partyA, chainId, pricesMap)

        return { uPnlB: minusOne.mul(uPnlB).toString(), uPnlA, notionalValueSumB: notionalValueSumB.toString(), notionalValueSumA, nonceB, nonceA, pricesMap, pricesB, pricesA, quoteIdsB, quoteIdsA }
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request
        switch (method) {
            case 'uPnl_A': {
                let { partyA, chainId } = params
                const result = await this.uPnlPartyA(partyA, chainId)
                return Object.assign({}, { chainId, partyA }, result)
            }

            case 'uPnl_B': {
                let { partyB, partyA, chainId } = params
                const result = await this.uPnlPartyB(partyB, partyA, chainId)
                return Object.assign({}, { chainId, partyB, partyA }, result)
            }

            case 'uPnl': {
                let { partyB, partyA, chainId } = params
                const result = await this.uPnlParties(partyB, partyA, chainId)
                return Object.assign({}, { chainId, partyB, partyA }, result)
            }

            case 'price': {
                let { quoteIds, chainId } = params

                quoteIds = JSON.parse(quoteIds)
                const result = await this.fetchPrices(quoteIds, chainId)
                return Object.assign({}, { chainId, quoteIds }, result)
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
        let { method } = request;
        switch (method) {
            case 'uPnl_A': {
                let { partyA, uPnl, notionalValueSum, nonce, chainId } = result

                if (!this.isUpnlToleranceOk(uPnl, request.data.result.uPnl, notionalValueSum, UPNL_TOLERANCE).isOk)
                    throw { message: 'uPnl Tolerance Error' }

                return [
                    { type: 'address', value: partyA },
                    { type: 'uint256', value: nonce },
                    { type: 'int256', value: request.data.result.uPnl },
                    { type: 'uint256', value: request.data.timestamp },
                    { type: 'uint256', value: chainId },
                ]
            }

            case 'uPnl_B': {
                let { partyB, partyA, uPnl, notionalValueSum, nonce, chainId } = result

                if (!this.isUpnlToleranceOk(uPnl, request.data.result.uPnl, notionalValueSum, UPNL_TOLERANCE).isOk)
                    throw { message: 'uPnl Tolerance Error' }

                return [
                    { type: 'address', value: partyB },
                    { type: 'address', value: partyA },
                    { type: 'uint256', value: nonce },
                    { type: 'int256', value: request.data.result.uPnl },
                    { type: 'uint256', value: request.data.timestamp },
                    { type: 'uint256', value: chainId },
                ]
            }

            case 'uPnl': {
                let { partyB, partyA, uPnlB, uPnlA, notionalValueSumB, notionalValueSumA, nonceB, nonceA, chainId } = result

                if (!this.isUpnlToleranceOk(uPnlB, request.data.result.uPnlB, notionalValueSumB, UPNL_TOLERANCE).isOk)
                    throw { message: 'uPnl Tolerance Error' }
                if (!this.isUpnlToleranceOk(uPnlA, request.data.result.uPnlA, notionalValueSumA, UPNL_TOLERANCE).isOk)
                    throw { message: 'uPnl Tolerance Error' }

                return [
                    { type: 'address', value: partyB },
                    { type: 'address', value: partyA },
                    { type: 'uint256', value: nonceB },
                    { type: 'uint256', value: nonceA },
                    { type: 'int256', value: request.data.result.uPnlB },
                    { type: 'int256', value: request.data.result.uPnlA },
                    { type: 'uint256', value: request.data.timestamp },
                    { type: 'uint256', value: chainId },
                ]
            }

            case 'price': {
                let { quoteIds, prices, chainId } = result

                for (let [i, price] of prices.entries()) {
                    if (!this.isPriceToleranceOk(price, request.data.result.prices[i], PRICE_TOLERANCE).isOk)
                        throw { message: `Price Tolerance Error` }
                }

                return [
                    { type: 'uint256[]', value: quoteIds },
                    { type: 'uint256[]', value: request.data.result.prices },
                    { type: 'uint256', value: request.data.timestamp },
                    { type: 'uint256', value: chainId },
                ]
            }

            default:
                break
        }
    }
}