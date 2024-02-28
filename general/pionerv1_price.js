require('dotenv').config();
const { BN, toBaseUnit, Web3, axios } = MuonAppUtils;

const PionerV1App = {
    APP_NAME: 'pionerV1_oracle',
    useTss: true,

    onRequest: async function (request) {
        let { method, data: { params = {} } } = request;
        switch (method) {
            case 'price':
                const { requestAsset1, requestAsset2, requestPairBid, requestPairAsk, requestConfidence, requestSignTime, requestPrecision, maxtimestampdiff } = params;
                const prices = await this.makeApiCalls(maxtimestampdiff, requestPrecision, requestAsset1, requestAsset2);

                return {
                    requestAsset1: this.convertToBytes32(requestAsset1),
                    requestAsset2: this.convertToBytes32(requestAsset2),
                    requestPairBid: requestPairBid.toString(),
                    requestPairAsk: requestPairAsk.toString(),
                    pairBid: prices.pairBid.toString(),
                    pairAsk: prices.pairAsk.toString(),
                    confidence: prices.confidence.toString(),
                    requestConfidence: requestConfidence.toString(),
                    requestSignTime: requestSignTime.toString(),
                    requestPrecision: requestPrecision.toString(),
                    proxyTimestamp: prices.timestamp.toString(),
                };
        }
    },

    signParams: function (request, result) {

        const requestPairBidBN = new BN((result.requestPairBid * 1e18).toFixed(0), 10);
        const requestPairAskBN = new BN((result.requestPairAsk * 1e18).toFixed(0), 10);
        const pairBidBN = new BN((result.pairBid * 1e18).toFixed(0), 10);
        const pairAskBN = new BN((result.pairAsk * 1e18).toFixed(0), 10);
        const confidenceBN = new BN((result.confidence * 1e18).toFixed(0), 10);
        const requestConfidenceBN = new BN((result.requestConfidence * 1e18).toFixed(0), 10);
        const requestSignTime = result.requestSignTime ;
        const proxyTimestamp = result.proxyTimestamp ;

        if (confidenceBN.gt(requestConfidenceBN)) {throw new Error(`0x101`);}
        if( Number(proxyTimestamp) > Number(requestSignTime)) { throw new Error(`0x102`);}

        const precision = new BN(10).pow(new BN(18)); 
        
        const diffBid = precision.sub(pairBidBN.mul(precision).div(requestPairBidBN)).abs();
        const diffAsk = precision.sub(pairAskBN.mul(precision).div(requestPairAskBN)).abs();
        
        if (diffBid.gt(requestConfidenceBN)) {
            throw new Error(`0x103`);
        }
        
        if (diffAsk.gt(requestConfidenceBN)) {
            throw new Error(`0x104`);
        }   
        const convertresult = this.convertToBytes32(result.requestAsset1);
        const convertresult2 = this.convertToBytes32(result.requestAsset2);

        switch (request.method) {
            case 'price':
                return [
                    { name: 'requestAsset1', type: 'bytes32', value: convertresult },
                    { name: 'requestAsset2', type: 'bytes32', value: convertresult2},
                    { name: 'requestPairBid', type: 'uint256', value: this.scaleUp(result.requestPairBid).toString() },
                    { name: 'requestPairAsk', type: 'uint256', value: this.scaleUp(result.requestPairAsk).toString() },
                    { name: 'requestConfidence', type: 'uint256', value: this.scaleUp(result.requestConfidence).toString() },
                    { name: 'requestSignTime', type: 'uint256', value: result.requestSignTime},
                    { name: 'requestPrecision', type: 'uint256', value: this.scaleUp(result.requestPrecision).toString() }
                ];
        }
    },

    makeApiCalls: async function(maxtimestampdiff, abPrecision, asset1, asset2) {
        try {
            const proxyVars = process.env.APPS_PIONERV1_VARS;
            const proxies = JSON.parse(proxyVars);
    
            const responsePromises = [];
            for (let i = 1; i <= parseInt(proxies.PROXY_NUMBERS); i++) {
                const proxy = proxies[`PROXY${i}`];
                const apiKey = proxies[`PROXY${i}KEY`];
    
                const apiUrl = `${proxy}${apiKey}&a=${asset1}&b=${asset2}&abprecision=${abPrecision}&confprecision=${abPrecision}&maxtimestampdiff=${maxtimestampdiff}`;
    
                const timeoutConfig = { timeout: 500 };
                
                responsePromises.push(axios.get(apiUrl, timeoutConfig).then(response => {
                    if (response.status === 200) {
                        const { pairBid, pairAsk, confidence, timestamp } = response.data;
                        const numericPairBid = parseFloat(pairBid);
                        const numericPairAsk = parseFloat(pairAsk);
                        const numericConfidence = parseFloat(confidence);
                        const numericTimestamp = parseFloat(timestamp);
    
                        if (!isNaN(numericPairBid) &&
                            !isNaN(numericPairAsk) &&
                            !isNaN(numericConfidence) &&
                            !isNaN(numericTimestamp)) {
                            return { ...response, data: { ...response.data, pairBid: numericPairBid, pairAsk: numericPairAsk, confidence: numericConfidence, timestamp: numericTimestamp } };
                        } else {
                            console.log(`Invalid data from Proxy ${i}.`);
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
            if ( validResponses.length > 0 ) {
                let averageTimestamp = 0;
                let averagePairBid = 0;
                let averagePairAsk = 0;
                let averageConfidence = 0;
    
                for (const response of validResponses) {
                    const { timestamp, pairBid, pairAsk, confidence } = response.data;
    
                    averageTimestamp += timestamp;
                    averagePairBid += pairBid;
                    averagePairAsk += pairAsk;
                    averageConfidence += confidence;
                }
    
                averageTimestamp /= validResponses.length;
                averagePairBid /= validResponses.length;
                averagePairAsk /= validResponses.length;
                averageConfidence /= validResponses.length;
    
                let closestDistance = Infinity;
                let closestResponse = null;
    
                for (const response of validResponses) {
                    const { timestamp, pairBid, pairAsk, confidence } = response.data;
    
                    const distance = Math.abs(timestamp - averageTimestamp) +
                                     Math.abs(pairBid - averagePairBid) +
                                     Math.abs(pairAsk - averagePairAsk) +
                                     Math.abs(confidence - averageConfidence);
    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestResponse = response.data;
                    }
                }
    
                return closestResponse;
            }
        } catch (error) {
            console.error('Error making API calls:', error);
        }
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