require('dotenv').config();
const { BN, toBaseUnit, Web3, axios } = MuonAppUtils;

const PionerV1App = {
    APP_NAME: 'pionerV1_oracle',
    useTss: true,

    onRequest: async function (request) {
        let { method, data: { params = {} } } = request;
        switch (method) {
            case 'price':
                const { asset1, asset2 } = params;
                const prices = await this.fetchPrices(asset1, asset2);
                const isMarketOpen = this.isValidPriceData(prices, /* appropriate config */);

                return {
                    asset1: this.convertToBytes32(asset1),
                    asset2: this.convertToBytes32(asset2),
                    pairBid: this.scaleUp(prices.pairBid).toString(),
                    pairAsk: this.scaleUp(prices.pairAsk).toString(),
                    confidence: this.scaleUp(prices.confidence).toString()

                };
        }
    },

    signParams: function (request, result) {
        const signTime = result.oldestTimestamp ? result.oldestTimestamp : Math.floor(Date.now() / 1000);

        switch (request.method) {
            case 'price':
                return [
                    { name:'asset1' ,type: 'bytes32', value: result.asset1 },
                    { name:'asset2' ,type: 'bytes32', value: result.asset2 },
                    { name:'pairBid' ,type: 'uint256', value: result.pairBid },
                    { name:'pairAsk' ,type: 'uint256', value: result.pairAsk },
                    { name:'confidence' ,type: 'uint256', value: result.confidence },
                    { name:'signTime' ,type: 'uint256', value: signTime.toString() }
                ];
        }
    },

fetchPrices: async function (asset1, asset2) {
    const [result1, result2] = await Promise.all([
        this.fetchAssetPrices(asset1),
        this.fetchAssetPrices(asset2)
    ]);

    const adjustedPrices1 = asset1 === 'hardusd' ? { avgBid: 1, avgAsk: 1 } : this.calculateAveragePrices(result1.prices);
    const adjustedPrices2 = asset2 === 'hardusd' ? { avgBid: 1, avgAsk: 1 } : this.calculateAveragePrices(result2.prices);
    const asset1Confidence = asset1 === 'hardusd' ? 0 : this.calculateConfidence(result1.prices);
    const asset2Confidence = asset2 === 'hardusd' ? 0 : this.calculateConfidence(result2.prices);
    const highestConfidence = Math.max(asset1Confidence, asset2Confidence);
    const oldestTimestamp = Math.min(result1.oldestTimestamp, result2.oldestTimestamp);

    return {
        pairBid: adjustedPrices1.avgBid / adjustedPrices2.avgBid,
        pairAsk: adjustedPrices1.avgAsk / adjustedPrices2.avgAsk,
        confidence: Math.max(1 - highestConfidence / 100, 0),
        oldestTimestamp
    };
},

    fetchAssetPrices: async function (asset) {
        if (asset === 'hardusd') return { prices: [{ bid: 1, ask: 1, timestamp: null }], oldestTimestamp: null };
        const [assetType, assetSymbol] = asset.split('.');
        const apiConfigs = this.loadApiConfigsForType(assetType);
        let oldestTimestamp = Infinity;
        const prices = [];

        for (const config of apiConfigs) {
            const formattedSymbol = this.formatSymbolForAPI(assetType, assetSymbol);
            const priceData = await this.fetchPriceFromAPI(config, formattedSymbol);
            if (priceData) {
                prices.push(priceData);
                if (priceData.timestamp && priceData.timestamp < oldestTimestamp) {
                    oldestTimestamp = priceData.timestamp;
                }
            }
        }
        return { prices, oldestTimestamp };
    },

    loadApiConfigsForType: function (assetType) {
        const configs = [];
        const prefix = `API_${assetType.toUpperCase()}_`;
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith(prefix)) {
                const parts = key.substring(prefix.length).split('_');
                const apiIdentifier = parts[0];
                const attribute = parts.slice(1).join('_').toLowerCase();
                const existingConfig = configs.find(c => c.identifier === apiIdentifier);
                if (existingConfig) {
                    existingConfig[attribute] = value;
                } else {
                    configs.push({ identifier: apiIdentifier, [attribute]: value });
                }
            }
        }
        return configs;
    },

    formatSymbolForAPI: function (assetType, symbol) {
        return assetType === 'fx' ? symbol.toLowerCase() : symbol.toUpperCase();
    },

    fetchPriceFromAPI: async function (config, symbol) {
        const url = `${config.url_before_asset}${symbol}${config.url_after_asset}`;
        try {
            const response = await axios.get(url);
            const data = Array.isArray(response.data) ? response.data[0] : response.data;
    
            const timestampField = config.time_field;
            const timestamp = data[timestampField] ? parseInt(data[timestampField]) : null;
            console.log(data, config.bid_field,config.ask_field );
            return {
                bid: parseFloat(data[config.bid_field]),
                ask: parseFloat(data[config.ask_field]),
                timestamp
            };
        } catch (error) {
            console.error(`Error fetching price from API: `, error);
            return null;
        }
    },
    
    isValidPriceData: function (data, config) {
        const hasRequiredFields = data && 
                                  data.hasOwnProperty(config.bid_field) && 
                                  data.hasOwnProperty(config.ask_field) && 
                                  data.hasOwnProperty(config.time_field);
    
        if (!hasRequiredFields) return false;
    
        const bidAskValid = data[config.bid_field] != null && data[config.ask_field] != null;
        const timestampValid = data[config.time_field] != null && parseInt(data[config.time_field]) >= 10000;
    
        return bidAskValid && timestampValid;
    },
    

    calculateAveragePrices: function (prices) {
        const totalBid = prices.reduce((sum, price) => sum + (price ? price.bid : 0), 0);
        const totalAsk = prices.reduce((sum, price) => sum + (price ? price.ask : 0), 0);
        const count = prices.filter(price => price).length;
        return {
            avgBid: count > 0 ? totalBid / count : NaN,
            avgAsk: count > 0 ? totalAsk / count : NaN
        };
    },

    calculateConfidence: function (prices) {
        let minBid = prices[0].bid, maxBid = prices[0].bid;
        let minAsk = prices[0].ask, maxAsk = prices[0].ask;
        prices.forEach(price => {
            if (price.bid < minBid) minBid = price.bid;
            if (price.bid > maxBid) maxBid = price.bid;
            if (price.ask < minAsk) minAsk = price.ask;
            if (price.ask > maxAsk) maxAsk = price.ask;
        });
        const bidSpread = ((maxBid - minBid) / minBid) * 100;
        const askSpread = ((maxAsk - minAsk) / minAsk) * 100;
        return Math.max(bidSpread, askSpread);
    },
    

    convertToBytes32: function (str) {
        const hex = Web3.utils.toHex(str);
        return Web3.utils.padRight(hex, 64);
    },

    scaleUp: function (value) {
        return new BN(toBaseUnit(String(value), 18));
    }
};

module.exports = PionerV1App;
