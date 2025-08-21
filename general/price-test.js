const {axios} = MuonAppUtils;

module.exports = {
    APP_NAME: 'price_test',

    onRequest: async function (request) {
        let {method, data: {params}} = request;
        switch (method) {
            case 'get_price':
                const currencyName = params.currency;
                const response = await axios
                    .get(`https://api.coingecko.com/api/v3/simple/price?ids=${currencyName}&vs_currencies=usd`);
                let price = response.data;
                if (price[currencyName])
                    price = parseInt(price[currencyName]["usd"] * 1000000);
                else
                    throw `get price failed`;
                return {price};
            case 'test':
                return {test: "OK"};
            default:
                throw `Unknown method ${method}`
        }
    },

    signParams: function (request, result) {
        let {method} = request;
        let {price, test} = result;
        switch (method) {
            case 'get_price':
                return [
                    {type: 'uint32', value: price}
                ];
            case 'test':
                return [
                    {type: 'string', value: test}
                ];
            default:
                throw `Unknown method '${method}'`
        }
    }
};