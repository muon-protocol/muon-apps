const { BN, toBaseUnit, ethCall, Web3 } = MuonAppUtils;
const MetaApi = require('metaapi.cloud-sdk').default;

const token = process.env.META_API_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const scaleUp = (value) => new BN(toBaseUnit(String(value), 18))
const TOLERANCE = scaleUp('0.001')
const ETH = scaleUp(1);
const api = new MetaApi(token);

const ABI = [{ "inputs": [{ "internalType": "uint256[]", "name": "positionIds", "type": "uint256[]" }], "name": "getMarketsFromPositionIds", "outputs": [{ "components": [{ "internalType": "uint256", "name": "marketId", "type": "uint256" }, { "internalType": "string", "name": "identifier", "type": "string" }, { "internalType": "enum MarketType", "name": "marketType", "type": "uint8" }, { "internalType": "bool", "name": "active", "type": "bool" }, { "internalType": "string", "name": "baseCurrency", "type": "string" }, { "internalType": "string", "name": "quoteCurrency", "type": "string" }, { "internalType": "string", "name": "symbol", "type": "string" }, { "internalType": "bytes32", "name": "muonPriceFeedId", "type": "bytes32" }, { "internalType": "bytes32", "name": "fundingRateId", "type": "bytes32" }], "internalType": "struct Market[]", "name": "markets", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }]
const ADDRESS = '0x212e1A33350a85c4bdB2607C47E041a65bD14361';

const CHAINS = {
    fantom: 250,
    arbitrum: 42161,
};

module.exports = {
    APP_NAME: 'v3_oracle',

    isPriceToleranceOk: function (price, expectedPrice, priceTolerance) {
        let priceDiff = new BN(price).sub(new BN(expectedPrice)).abs()
        const priceDiffPercentage = new BN(priceDiff).mul(ETH).div(new BN(expectedPrice))
        return {
            isOk: !priceDiffPercentage.gt(new BN(priceTolerance)),
            priceDiffPercentage: priceDiffPercentage.mul(new BN(100)).div(ETH)
        }
    },

    getSymbols: async function (positionIds) {
        const markets = await ethCall(ADDRESS, 'getMarketsFromPositionIds', [positionIds], ABI, CHAINS.arbitrum);
        const positions = [];
        const symbolsPerPriceFeed = {};

        markets.forEach((market, i) => {
            if (market.symbol == '') throw { message: 'Invalid PositionId' }
            positions.push({
                positionId: positionIds[i],
                symbol: market.symbol,
                priceFeedId: market.muonPriceFeedId
            });

            if (!symbolsPerPriceFeed[market.muonPriceFeedId])
                symbolsPerPriceFeed[market.muonPriceFeedId] = new Set([market.symbol]);
            else
                symbolsPerPriceFeed[market.muonPriceFeedId].add(market.symbol);
        });

        return { positions, symbolsPerPriceFeed };
    },

    getConnection: async function () {
        let account = await api.metatraderAccountApi.getAccount(accountId);
        const connection = account.getRPCConnection();
        await connection.connect();
        await connection.waitSynchronized();

        return connection;
    },

    getSymbolPrice: async function (symbol) {
        const connection = await this.getConnection();
        const price = await connection.getSymbolPrice(symbol);
        return price;
    },

    fetchPricesFromFinnhub: async function (symbols) {

    },

    fetchPricesFromMetaAPI: async function (symbols) {
        const prices = {}
        const promises = []
        symbols.forEach((symbol) => {
            promises.push(this.getSymbolPrice(symbol));
        });

        const result = await Promise.all(promises);

        result.forEach((tick) => {
            prices[tick.symbol] = {
                bid: toBaseUnit(String(tick.bid), '18').toString(),
                ask: toBaseUnit(String(tick.ask), '18').toString(),
                // last: toBaseUnit(String(tick.last), '18').toString(),
            };
        });

        return prices;
    },

    fetchPricesFromPriceFeed: async function (symbols, priceFeedId) {
        switch (priceFeedId) {
            case Web3.utils.fromAscii('metaAPI') + '00000000000000000000000000000000000000000000000000': {
                return await this.fetchPricesFromMetaAPI(symbols);
            }

            case Web3.utils.fromAscii('finnhub'): {
                return await this.fetchPricesFromFinnhub(symbols);
            }

            default: {
                throw { message: 'Invalid PriceFeed' }
            }
        }
    },

    getPrices: async function (symbolsPerMarket) {
        let prices = {};
        const promises = [];
        const priceFeeds = []

        for (let [priceFeedId, symbols] of Object.entries(symbolsPerMarket)) {
            promises.push(this.fetchPricesFromPriceFeed(symbols, priceFeedId))
            priceFeeds.push(priceFeedId)
        }

        const result = await Promise.all(promises);

        priceFeeds.forEach((id, index) => prices[id] = result[index])

        return prices;
    },

    onRequest: async function (request) {
        let {
            method,
            data: { params }
        } = request;
        switch (method) {
            case 'signature':
                let { positionIds } = params;

                positionIds = JSON.parse(positionIds);
                positionIds.forEach((id) => {
                    if (!Number.isInteger(id)) throw { message: `Invalid positionId` };
                });

                const { positions, symbolsPerPriceFeed } = await this.getSymbols(positionIds);
                const prices = await this.getPrices(symbolsPerPriceFeed);

                let bidPrices = [];
                let askPrices = [];
                positions.forEach((position) => {
                    const price = prices[position.priceFeedId][position.symbol];
                    bidPrices.push(price.bid);
                    askPrices.push(price.ask);
                });

                return {
                    positionIds,
                    bidPrices,
                    askPrices,
                    appCID: await this.APP_CID
                };

            default:
                throw { message: `Unknown method ${params}` };
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
            case 'signature':
                let { positionIds, bidPrices, askPrices, appCID } = request.data.result;

                for (let i = 0; i < positionIds.length; i++) {
                    if (!this.isPriceToleranceOk(bidPrices[i], request.data.result.bidPrices[i], TOLERANCE).isOk)
                        throw { message: `Price Tolerance Error` }

                    if (!this.isPriceToleranceOk(askPrices[i], request.data.result.askPrices[i], TOLERANCE).isOk)
                        throw { message: `Price Tolerance Error` }
                }

                let res;
                if (positionIds.length > 1)
                    res = [
                        { type: "bytes", value: appCID },
                        { type: 'uint256[]', value: positionIds },
                        { type: 'uint256[]', value: bidPrices },
                        { type: 'uint256[]', value: askPrices }
                    ];
                else
                    res = [
                        { type: "bytes", value: appCID },
                        { type: 'uint256', value: positionIds[0] },
                        { type: 'uint256', value: bidPrices[0] },
                        { type: 'uint256', value: askPrices[0] }
                    ];

                return [
                    ...res,
                    { type: 'uint256', value: request.data.timestamp },
                ];
            default:
                break;
        }
    }
}