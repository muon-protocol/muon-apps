const { BN, toBaseUnit, ethCall } = MuonAppUtils;
const MetaApi = require('metaapi.cloud-sdk').default;

const token = process.env.TOKEN;
const accountId = process.env.ACCOUNT_ID;

const api = new MetaApi(token);

const ABI = [{ "inputs": [{ "internalType": "uint256[]", "name": "positionIds", "type": "uint256[]" }], "name": "getMarketsFromPositionIds", "outputs": [{ "components": [{ "internalType": "uint256", "name": "marketId", "type": "uint256" }, { "internalType": "string", "name": "identifier", "type": "string" }, { "internalType": "enum MarketType", "name": "marketType", "type": "uint8" }, { "internalType": "bool", "name": "active", "type": "bool" }, { "internalType": "string", "name": "baseCurrency", "type": "string" }, { "internalType": "string", "name": "quoteCurrency", "type": "string" }, { "internalType": "string", "name": "symbol", "type": "string" }, { "internalType": "bytes32", "name": "muonPriceFeedId", "type": "bytes32" }, { "internalType": "bytes32", "name": "fundingRateId", "type": "bytes32" }], "internalType": "struct Market[]", "name": "markets", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }]
const ADDRESS = '0x2650b195C900d782D84Ffeb7a8B5e150aFB5a8bF';

const CHAINS = {
    fantom: 250,
    arbitrum: 42161,
};

module.exports = {
    APP_NAME: 'v3_oracle',

    getSymbols: async function (positionIds) {
        const markets = await ethCall(ADDRESS, 'getMarketsFromPositionIds', [positionIds], ABI, CHAINS.arbitrum);
        const positions = [];
        const symbolsPerPriceFeed = {};

        markets.forEach((market, i) => {
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

    getSymbolPrice: async function (connection, symbol) {
        const price = await connection.getTick(symbol);
        return price;
    },

    getPrices: async function (connection, symbols) {
        let prices = {};
        const promises = [];

        symbols.forEach((symbol) => {
            promises.push(this.getSymbolPrice(connection, symbol));
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

                const { positions, symbols } = await this.getSymbols(positionIds);
                const connection = await this.getConnection();
                const prices = await this.getPrices(connection, symbols);

                let bidPrices = [];
                let askPrices = [];
                positions.forEach((position) => {
                    const price = prices[position.symbol];
                    bidPrices.push(price.bid);
                    askPrices.push(price.ask);
                });

                return {
                    positionIds,
                    bidPrices,
                    askPrices
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
                let { positionIds, bidPrices, askPrices } = request.data.result;

                let res;
                if (positionIds.length > 1)
                    res = [
                        { type: 'uint256[]', value: positionIds },
                        { type: 'uint256[]', value: bidPrices },
                        { type: 'uint256[]', value: askPrices }
                    ];
                else
                    res = [
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