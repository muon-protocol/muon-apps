require('dotenv').config();
const { BN, toBaseUnit, Web3, axios } = MuonAppUtils;

const PionerV1App = {
    APP_NAME: 'pionerV1_oracle',
    useTss: true,

    onRequest: async function (request) {
        let { method, data: { params = {} } } = request;
        switch (method) {
            case 'price':
                const { requestAsset1, requestAsset2, requestPairBid, requestPairAsk, requestConfidence, requestSignTime, requestPrecision, maxTimestampDiff } = params;
                const prices = await this.makeApiCalls(maxTimestampDiff, requestPrecision, requestAsset1, requestAsset2);

                return {
                    requestAsset1: this.convertToBytes32(requestAsset1),
                    requestAsset2: this.convertToBytes32(requestAsset2),
                    requestPairBid: requestPairBid,
                    requestPairAsk: requestPairAsk,
                    pairBid: prices.pairBid,
                    pairAsk: prices.pairAsk,
                    confidence: prices.confidence,
                    requestConfidence: requestConfidence,
                    requestSignTime: requestSignTime,
                    requestPrecision: requestPrecision,
                    proxyTimestamp: prices.timestamp,
                };

            default:
                throw { message: `101 - Unknown method ${params}` }
        }
    },

    signParams: function (request, result) {
        const requestPairBidBN = this.scaleUp(result.requestPairBid);
        const requestPairAskBN = this.scaleUp(result.requestPairAsk);
        const pairBidBN = this.scaleUp(result.pairBid);
        const pairAskBN = this.scaleUp(result.pairAsk);
        const confidenceBN = this.scaleUp(result.confidence);
        const requestConfidenceBN = this.scaleUp(result.requestConfidence);
        const requestSignTime = result.requestSignTime;
        const proxyTimestamp = result.proxyTimestamp;

        if (confidenceBN.gt(requestConfidenceBN)) { throw { message: '102 - confidence > requestConfidence' } }
        if (proxyTimestamp > parseInt(requestSignTime)) { throw { message: '103 - proxyTimestamp > requestSignTime' } }

        const precision = new BN('1000000000000000000');

        const diffBid = precision.sub(pairBidBN.mul(precision).div(requestPairBidBN)).abs();
        const diffAsk = precision.sub(pairAskBN.mul(precision).div(requestPairAskBN)).abs();

        if (diffBid.gt(requestConfidenceBN)) {
            throw { message: '104 - diffBid > requestConfidence' }
        }

        if (diffAsk.gt(requestConfidenceBN)) {
            throw { message: '105 - diffAsk > requestConfidence' }
        }


        const assetHex = this.convertToBytes32(result.requestAsset1 + '/' + result.requestAsset2);
        switch (request.method) {
            case 'price':
                return [
                    { name: 'requestAssetHex', type: 'bytes32', value: assetHex },
                    { name: 'requestPairBid', type: 'uint256', value: requestPairBidBN.toString() },
                    { name: 'requestPairAsk', type: 'uint256', value: requestPairAskBN.toString() },
                    { name: 'requestConfidence', type: 'uint256', value: requestConfidenceBN.toString() },
                    { name: 'requestSignTime', type: 'uint256', value: result.requestSignTime },
                    { name: 'requestPrecision', type: 'uint256', value: this.scaleUp(result.requestPrecision).toString() }
                ];
        }
    },

    makeApiCalls: async function (maxTimestampDiff, abPrecision, asset1, asset2) {
        const proxyVars = process.env.APPS_PIONERV1_PROXIES;
        const proxies = JSON.parse(proxyVars);

        const responsePromises = [];

        for (let i = 1; i <= Object.keys(proxies).length; i++) {
            const address = proxies[i].address;
            const key = proxies[i].key;

            const apiUrl = `${address}${key}&a=${asset1}&b=${asset2}&abPrecision=${abPrecision}&confPrecision=${abPrecision}&maxTimestampDiff=${maxTimestampDiff}`;

            responsePromises.push(axios.get(apiUrl).then(response => {
                if (response.status === 200) {
                    const { pairBid, pairAsk, confidence, timestamp } = response.data;
                    response.data.floatPairBid = parseFloat(pairBid);
                    response.data.floatPairAsk = parseFloat(pairAsk);
                    response.data.floatConfidence = parseFloat(confidence);

                    if (response.data.floatPairBid && response.data.floatPairAsk && !isNaN(response.data.floatConfidence) && timestamp) {
                        return response;
                    } else {
                        console.log(`Received invalid data from Proxy ${i}.`);
                        return null;
                    }
                } else {
                    console.log(`Invalid response status from Proxy ${i}. Status: ${response.status}. url: ${apiUrl}`);
                    return null;
                }
            }).catch(error => {
                console.error(`Error with Proxy : ${error.message}. Url ${apiUrl} :`);
                return null;
            }));
        }

        const responses = await Promise.all(responsePromises);

        const validResponses = responses.filter(response => response !== null);
        if (validResponses.length == 0) {
            throw { message: '106 - No valid responses from any proxies.' }
        }

        let averageTimestamp = 0;
        let averagePairBid = 0;
        let averagePairAsk = 0;
        let averageConfidence = 0;

        for (const response of validResponses) {
            const { timestamp, floatPairBid, floatPairAsk, floatConfidence } = response.data;

            averageTimestamp += timestamp;
            averagePairBid += floatPairBid;
            averagePairAsk += floatPairAsk;
            averageConfidence += floatConfidence;
        }

        averageTimestamp /= validResponses.length;
        averagePairBid /= validResponses.length;
        averagePairAsk /= validResponses.length;
        averageConfidence /= validResponses.length;

        let closestDistance = Infinity;
        let closestResponse = null;

        for (const response of validResponses) {
            const { timestamp, floatPairBid, floatPairAsk, floatConfidence } = response.data;

            const distance = Math.abs(timestamp - averageTimestamp) +
                Math.abs(floatPairBid - averagePairBid) +
                Math.abs(floatPairAsk - averagePairAsk) +
                Math.abs(floatConfidence - averageConfidence);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestResponse = response.data;
            }
        }

        return closestResponse;
    },

    convertToBytes32: function (str) {
        const maxLength = 31;
        const truncatedStr = str.slice(0, maxLength);
        const hex = Web3.utils.toHex(truncatedStr);
        return Web3.utils.padRight(hex, 64);
    },

    scaleUp: function (value) {
        return new BN(toBaseUnit(String(value), 18));
    }
};

module.exports = PionerV1App;
