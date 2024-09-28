const { ethGetBlock, ethGetTransaction, ethGetTransactionReceipt, ethCall} = MuonAppUtils

const EVMUtilsApp = {
    APP_NAME: 'evm_data_verifier',
    useFrost: true,

    getTimestamp: () => Math.floor(Date.now() / 1000),

    onRequest: async function (request) {
        let { method, data: { params } } = request;
        switch (method) {
            case 'get-block': {
                let {
                    network,
                    block
                } = params

                let {
                    number,
                    hash,
                    timestamp,
                    transactions
                } = await ethGetBlock(network, block);

                return {
                    number: number.toString(),
                    hash: hash.toString(),
                    timestamp: timestamp.toString(),
                    transactions
                }
            }
            case 'get-transaction': {
                let {
                    network,
                    txHash
                } = params

                let {
                    hash,
                    nonce,
                    blockHash,
                    blockNumber,
                    transactionIndex,
                    from,
                    to,
                    value,
                    gas,
                    gasPrice
                } = await ethGetTransaction(txHash, network);

                let {
                    timestamp
                } = await ethGetBlock(network, blockNumber);

                return {
                    timestamp: timestamp.toString(),
                    hash: hash.toString(),
                    nonce: nonce.toString(),
                    blockHash: blockHash.toString(),
                    blockNumber: blockNumber.toString(),
                    transactionIndex: transactionIndex.toString(),
                    from: from.toString(),
                    to: to?.toString() || "",
                    value: value.toString(),
                    gas: gas.toString(),
                    gasPrice: gasPrice.toString() 
                }
            }
            case 'contract-call': {
                let {
                    contractAddress, 
                    method, 
                    args,
                    abi, 
                    network
                } = params

                args = args.split(",")

                let functionResult = await ethCall(contractAddress, method, args, JSON.parse(abi), network);

                const now = this.getTimestamp();

                if (typeof functionResult == "object") {
                    let result = []
                    for (let index = 0; index < functionResult.__length__; index++) {
                        result.push(functionResult[index].toString());
                    }
                    return {
                        timestamp: now.toString(),
                        functionResult: result
                    };
                }

                return {
                    timestamp: now.toString(),
                    functionResult: functionResult.toString()
                };
            }
            default:
                throw { message: `invalid method ${method}` }
        }
    },

    signParams: function (request, result) {
        switch (request.method) {
            case 'get-block': {
                let {
                    number,
                    hash,
                    timestamp,
                    transactions
                } = result

                return [
                    { type: 'uint256', value: number },
                    { type: 'string', value: hash },
                    { type: 'uint256', value: timestamp },
                    { type: 'string[]', value: transactions }
                ]
            }
            case 'get-transaction': {
                let {
                    timestamp,
                    hash,
                    nonce,
                    blockHash,
                    blockNumber,
                    transactionIndex,
                    from,
                    to,
                    value,
                    gas,
                    gasPrice
                } = result


                return [
                    { type: "string", value: timestamp },
                    { type: 'string', value: hash },
                    { type: 'uint256', value: nonce },
                    { type: 'string', value: blockHash },
                    { type: 'uint256', value: blockNumber },
                    { type: 'uint256', value: transactionIndex },
                    { type: 'string', value: from },
                    { type: 'string', value: to },
                    { type: 'uint256', value: value },
                    { type: 'uint256', value: gasPrice },
                    { type: 'uint256', value: gas },
                ]
            }
            case 'contract-call': {
                let { data: { params: { abi }}} = request
                abi = JSON.parse(abi)
                const {outputs} = abi[0]

                let {
                    timestamp,
                    functionResult
                } = result;

                const res = outputs.reduce((res, currentItem, i) => {
                    res.push({type: currentItem['type'], value: functionResult[i]});
                    return res;
                }, []);
                
                return [
                    { type: "string", value: timestamp },
                    ...res
                ];
            }
            default:
                throw { message: `Unknown method: ${request.method}` }
        }
    }
}

module.exports = EVMUtilsApp
