const { json } = require('body-parser');

const { BN, toBaseUnit } = MuonAppUtils;
const MetaApi = require('metaapi.cloud-sdk').default;

const token = process.env.TOKEN;
const accountId = process.env.ACCOUNT_ID;

const api = new MetaApi(token);


module.exports = {
    APP_NAME: 'v3_oracle',
    APP_ID: 300,

    getSymbols: async function (positionIds) {

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

                return [
                    { type: 'uint32', value: this.APP_ID },
                    { type: 'uint256[]', value: positionIds },
                    { type: 'uint256[]', value: bidPrices },
                    { type: 'uint256[]', value: askPrices },
                    { type: 'uint256', value: request.data.timestamp },
                ];
            default:
                break;
        }
    }
}