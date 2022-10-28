(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(global, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 577:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const axios = __webpack_require__(167)
const Web3 = __webpack_require__(519)
const tron = __webpack_require__(623)
const { flatten, groupBy } = __webpack_require__(517)
const { BigNumber } = __webpack_require__(215)

const { toBaseUnit } = __webpack_require__(144)
const { timeout, floatToBN } = __webpack_require__(528)
const util = __webpack_require__(567)
const ws = __webpack_require__(352)
const ethSigUtil = __webpack_require__(685)
const {
  getBlock: ethGetBlock,
  getBlockNumber: ethGetBlockNumber,
  getPastEvents: ethGetPastEvents,
  read: ethRead,
  call: ethCall,
  getTokenInfo: ethGetTokenInfo,
  getNftInfo: ethGetNftInfo,
  hashCallOutput: ethHashCallOutput
} = __webpack_require__(775)

const soliditySha3 = __webpack_require__(108);

const { multiCall } = __webpack_require__(834)
const { BNSqrt } = __webpack_require__(196)

module.exports = {
  axios,
  Web3,
  flatten,
  groupBy,
  tron,
  ws,
  timeout,
  BN: Web3.utils.BN,
  BigNumber,
  toBN: Web3.utils.toBN,
  floatToBN,
  multiCall,
  ethGetBlock,
  ethGetBlockNumber,
  ethGetPastEvents,
  ethRead,
  ethCall,
  ethGetTokenInfo,
  ethGetNftInfo,
  ethHashCallOutput,
  toBaseUnit,
  soliditySha3,
  ecRecover: util.ecrecover,
  recoverTypedSignature: ethSigUtil.recoverTypedSignature,
  recoverTypedMessage: ethSigUtil.recoverTypedMessage,
  BNSqrt: BNSqrt
}


/***/ }),

/***/ 196:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const Web3 = __webpack_require__(519)

const BNSqrt = (num) => {
  const BN = Web3.utils.BN
  if(num.lt(new BN(0))) {
    throw { message: "Sqrt only works on non-negtiave inputs" }
  }
  if(num.lt(new BN(2))) {
    return num
  }

  const smallCand = BNSqrt(num.shrn(2)).shln(1)
  const largeCand = smallCand.add(new BN(1))

  if (largeCand.mul(largeCand).gt(num)) {
    return smallCand
  } else {
    return largeCand
  }
}

module.exports = { BNSqrt }

/***/ }),

/***/ 144:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const ethers = __webpack_require__(982)
const Web3 = __webpack_require__(519)
const {hashCallOutput} = __webpack_require__(775)
const BN = Web3.utils.BN
const web3 = new Web3();

// const PRIVATE_KEY = process.env.SIGN_WALLET_PRIVATE_KEY
// const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY)
// web3.eth.accounts.wallet.add(account)

function soliditySha3(params){
  return web3.utils.soliditySha3(...params);
}

function sign(hash) {
  let sig = web3.eth.accounts.sign(hash, PRIVATE_KEY)
  return sig.signature;
}

function recover(hash, signature){
  let signer = web3.eth.accounts.recover(hash, signature)
  return signer;
}

function toFixedHex(bigNum){
  return ethers.utils.hexZeroPad('0x' + bigNum.toString(16), 32);
}

function isString(s) {
  return (typeof s === 'string' || s instanceof String)
}

function toBaseUnit(value, decimals) {
  if (!isString(value)) {
    throw new Error('Pass strings to prevent floating point precision issues.')
  }
  const ten = new BN(10);
  const base = ten.pow(new BN(decimals));

  // Is it negative?
  let negative = (value.substring(0, 1) === '-');
  if (negative) {
    value = value.substring(1);
  }

  if (value === '.') {
    throw new Error(
      `Invalid value ${value} cannot be converted to`
      + ` base unit with ${decimals} decimals.`);
  }

  // Split it into a whole and fractional part
  let comps = value.split('.');
  if (comps.length > 2) { throw new Error('Too many decimal points'); }

  let whole = comps[0], fraction = comps[1];

  if (!whole) { whole = '0'; }
  if (!fraction) { fraction = '0'; }
  if (fraction.length > decimals) {
    throw new Error('Too many decimal places');
  }

  while (fraction.length < decimals) {
    fraction += '0';
  }

  whole = new BN(whole);
  fraction = new BN(fraction);
  let wei = (whole.mul(base)).add(fraction);

  if (negative) {
    wei = wei.neg();
  }

  return new BN(wei.toString(10), 10);
}

module.exports = {
  hashCallOutput,
  toFixedHex,
  soliditySha3,
  sign,
  recover,
  toBaseUnit,
}


/***/ }),

/***/ 775:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const Web3 = __webpack_require__(519)
const EventEmbitter = __webpack_require__(239)
const HttpProvider = Web3.providers.HttpProvider
const WebsocketProvider = Web3.providers.WebsocketProvider
const { sortObject, getTimestamp } = __webpack_require__(528)
const crypto = __webpack_require__(144)
const ERC20_ABI = __webpack_require__(920)
const ERC721_ABI = __webpack_require__(329)

const _generalWeb3Instance = new Web3()
const soliditySha3 = _generalWeb3Instance.utils.soliditySha3

const _networksWeb3 = {
  ganache: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_GANACHE)),
  // ethereum mani net
  1: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_ETH)),
  3: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_ROPSTEN)),
  4: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_RINKEBY)),
  56: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_BSC)),
  97: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_BSCTEST)),
  250: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_FTM)),
  4002: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_FTMTEST)),
  100: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_XDAI_MAINNET || 'https://rpc.xdaichain.com/')),
  77: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_XDAI_SOKOL_TESTNET || 'https://sokol.poa.network')),
  137: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_POLYGON)),
  80001: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_MUMBAI)),
  43113: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_AVALANCHE_FUJI_TESTNET || 'https://api.avax-test.network/ext/bc/C/rpc')),
  43114: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_AVALANCHE_MAINNET || 'https://api.avax.network/ext/bc/C/rpc')),
  421611: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_ARBITRUM_TESTNET || 'https://rinkeby.arbitrum.io/rpc')),
  42161: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_ARBITRUM_MAINNET || 'https://arb1.arbitrum.io/rpc')),
  1088: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_METIS || 'https://andromeda.metis.io/?owner=1088')),
  10: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_OPTIMISM || 'https://rpc.ankr.com/optimism')),
  420: new Web3(new HttpProvider(process.env.WEB3_PROVIDER_OPTIMISM_TESTNET || 'https://rpc.ankr.com/optimism_testnet')),
}

const nameToChainIdMap = {
  local: 'ganache',
  eth: 1, // Ethereum mainnet
  ropsten: 3, // Ethereum ropsten testnet
  rinkeby: 4, // Ethereum rinkeby testnet
  bsc: 56, // Binance Smart Chain mainnet
  bsctest: 97, // Binance Smart Chain testnet
  ftm: 250, // Fantom mainnet
  ftmtest: 4002, // Fantom testnet
  xdai: 100, // Xdai mainnet
  sokol: 77, // Xdai testnet
  polygon: 137, // polygon mainnet
  mumbai: 80001, // Polygon mumbai testnet
  fuji: 43113, // Avalanche Fuji Testnet
  avax: 43114, // Avalanche Mainnet
  arbitrumTestnet: 421611, //Arbitrum Testnet
  arbitrum: 42161, // Arbitrum
  metis: 1088, // Metis
  optimism: 10, // Optimism
  optimismTestnet: 420, // Optimism Testnet
}

function getWeb3(network) {
  if (_networksWeb3[network]) return Promise.resolve(_networksWeb3[network])
  else if (_networksWeb3[nameToChainIdMap[network]])
    return Promise.resolve(_networksWeb3[nameToChainIdMap[network]])
  else return Promise.reject({ message: `invalid network "${network}"` })
}

function getWeb3Sync(network) {
  if (_networksWeb3[network]) return _networksWeb3[network]
  else if (_networksWeb3[nameToChainIdMap[network]])
    return _networksWeb3[nameToChainIdMap[network]]
  else throw { message: `invalid network "${network}"` }
}

function hashCallOutput(
  address,
  method,
  abi,
  result,
  outputFilter = [],
  extraParams = []
) {
  let methodAbi = abi.find(
    ({ name, type }) => name === method && type === 'function'
  )
  if (!methodAbi) {
    throw { message: `Abi of method (${method}) not found` }
  }
  let abiOutputs = methodAbi.outputs
  if (!!outputFilter && outputFilter.length > 0) {
    abiOutputs = outputFilter.map((key) => {
      return methodAbi.outputs.find(({ name }) => name === key)
    })
  }
  // console.log('signing:',abiOutputs)
  let params = abiOutputs.map(({ name, type }) => ({
    type,
    value: !name || typeof result === 'string' ? result : result[name]
  }))
  params = [{ type: 'address', value: address }, ...params, ...extraParams]
  let hash = _generalWeb3Instance.utils.soliditySha3(...params)
  return hash
}

function getTokenInfo(address, network) {
  return getWeb3(network).then(async (web3) => {
    let contract = new web3.eth.Contract(ERC20_ABI, address)
    return {
      symbol: await contract.methods.symbol().call(),
      name: await contract.methods.name().call(),
      decimals: await contract.methods.decimals().call()
    }
  })
}
function getNftInfo(address, network) {
  return getWeb3(network).then(async (web3) => {
    let contract = new web3.eth.Contract(ERC721_ABI, address)
    return {
      symbol: await contract.methods.symbol().call(),
      name: await contract.methods.name().call()
    }
  })
}

function getTransaction(txHash, network) {
  return getWeb3(network).then((web3) => web3.eth.getTransaction(txHash))
}

function getTransactionReceipt(txHash, network) {
  return getWeb3(network).then((web3) => web3.eth.getTransactionReceipt(txHash))
}

function call(contractAddress, methodName, params, abi, network) {
  return getWeb3(network).then((web3) => {
    let contract = new web3.eth.Contract(abi, contractAddress)
    return contract.methods[methodName](...params).call()
  })
}

function read(contractAddress, property, params, abi, network) {
  return getWeb3(network).then((web3) => {
    let contract = new web3.eth.Contract(abi, contractAddress)
    return contract.methods[property].call(...params)
  })
}

function getBlock(network, blockHashOrBlockNumber) {
  return getWeb3(network).then((web3) => {
    return web3.eth.getBlock(blockHashOrBlockNumber)
  })
}

function getBlockNumber(network) {
  return getWeb3(network).then((web3) => {
    return web3.eth.getBlockNumber()
  })
}

function getPastEvents(network, contractAddress, abi, event, options) {
  return getWeb3(network).then((web3) => {
    let contract = new web3.eth.Contract(abi, contractAddress)
    return contract.getPastEvents(event, options)
  })
}

const subscribeLogEvent = (
  network,
  contractAddress,
  contractAbi,
  eventName,
  interval = 5000
) => {
  let subscribe = new Subscribe(
    network,
    contractAddress,
    contractAbi,
    eventName,
    interval
  )
  return subscribe
}

class Subscribe extends EventEmbitter {
  constructor(network, contractAddress, abi, eventName, interval = 15000) {
    super()
    let web3 = getWeb3Sync(network)
    let contract = new web3.eth.Contract(abi, contractAddress)

    this.web3 = web3
    this.network = network
    this.interval = interval
    this.contract = contract
    this.lastBlock = -1
    this.eventName = eventName
    this._handler = this._handler.bind(this)

    this.timeout = setTimeout(this._handler, interval)
  }

  async _handler() {
    if (this.lastBlock < 0) {
      let lastBlock = (await this.web3.eth.getBlockNumber()) - 9000
      console.log(
        `watch ${this.network}:${this.contract._address} (${this.eventName}) from block ${lastBlock}`
      )
      this.lastBlock = lastBlock
    }

    let { contract, eventName, lastBlock, network } = this
    contract.getPastEvents(
      eventName,
      {
        // filter: {id: id},
        fromBlock: lastBlock,
        toBlock: 'latest'
      },
      (error, result) => {
        if (!error) {
          let txs = []
          if (result.length > 0) {
            let lastBlock = Math.max(
              ...result.map(({ blockNumber }) => blockNumber)
            )
            this.lastBlock = lastBlock + 1
            txs = result.map(
              ({ transactionHash, returnValues, blockNumber }) => ({
                blockNumber,
                transactionHash,
                returnValues
              })
            )
            this.emit('event', txs, network, contract._address)
          }
        } else {
          this.emit('error', error, network, contract._address)
        }
      }
    )
    setTimeout(this._handler, this.interval)
  }
}

module.exports = {
  getWeb3,
  getBlock,
  getBlockNumber,
  getPastEvents,
  getWeb3Sync,
  hashCallOutput,
  soliditySha3,
  getTransaction,
  getTransactionReceipt,
  call,
  read,
  subscribeLogEvent,
  getTokenInfo,
  getNftInfo
}


/***/ }),

/***/ 528:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const BigNumber = __webpack_require__(215);
BigNumber.set({DECIMAL_PLACES: 26})
const toBN = (__webpack_require__(519).utils.toBN);

module.exports.timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
module.exports.getTimestamp = () => Math.floor(Date.now() / 1000);
module.exports.newCallId = () => {
  return Date.now().toString(32) + Math.floor(Math.random()*999999999).toString(32);
}
module.exports.sortObject = o => Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {})
module.exports.floatToBN = (num, decimals) => {
  let n0 = new BigNumber(num).multipliedBy(`1e${decimals}`);
  let n1 = n0.decimalPlaces(decimals).integerValue();
  return toBN(`0x${n1.toString(16)}`);
}
module.exports.parseBool = v => {
  if(typeof v === 'string')
    v = v.toLowerCase();
  return v === '1' || v==='true' || v === true || v === 1;
}

const flattenObject = (obj, prefix="") => {
  let result = {}
  if(Array.isArray(obj)){
    for(let i=0 ; i<obj.length ; i++){
      let newKey = !!prefix ? `${prefix}[${i}]` : `[${i}]`
      result = {
        ...result,
        ...flattenObject(obj[i], newKey)
      }
    }
  }
  else if(typeof obj === 'object' && obj !== null){
    for(let key of Object.keys(obj)){
      let newKey = !!prefix ? `${prefix}.${key}` : key
      result = {
        ...result,
        ...flattenObject(obj[key], newKey)
      }
    }
  }
  else{
    return !!prefix ? {[prefix]: obj} : obj
  }
  return result
}
module.exports.flattenObject = flattenObject
// https://stackoverflow.com/questions/28222228/javascript-es6-test-for-arrow-function-built-in-function-regular-function
module.exports.isArrowFn = (fn) => (typeof fn === 'function') && !/^(?:(?:\/\*[^(?:\*\/)]*\*\/\s*)|(?:\/\/[^\r\n]*))*\s*(?:(?:(?:async\s(?:(?:\/\*[^(?:\*\/)]*\*\/\s*)|(?:\/\/[^\r\n]*))*\s*)?function|class)(?:\s|(?:(?:\/\*[^(?:\*\/)]*\*\/\s*)|(?:\/\/[^\r\n]*))*)|(?:[_$\w][\w0-9_$]*\s*(?:\/\*[^(?:\*\/)]*\*\/\s*)*\s*\()|(?:\[\s*(?:\/\*[^(?:\*\/)]*\*\/\s*)*\s*(?:(?:['][^']+['])|(?:["][^"]+["]))\s*(?:\/\*[^(?:\*\/)]*\*\/\s*)*\s*\]\())/.test(fn.toString());

module.exports.deepFreeze = function deepFreeze (object) {
  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(object);

  // Freeze properties before freezing self

  for (const name of propNames) {
    const value = object[name];

    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }

  return Object.freeze(object);
}

module.exports.stackTrace = function() {
  let err = new Error();
  return err.stack;
}


/***/ }),

/***/ 834:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { Multicall } = __webpack_require__(317)
const { getWeb3 } = __webpack_require__(775)

async function multiCall(chainId, contractCallContext, tryAggregate = false) {
  try {
    const web3 = await getWeb3(chainId)
    const multicall = new Multicall({ web3Instance: web3, tryAggregate })
    let { results } = await multicall.call(contractCallContext)
    results = contractCallContext.map((item) => ({
      reference: item.reference,
      contractAddress: item.contractAddress,
      context: item.context,
      callsReturnContext: results[item.reference]['callsReturnContext'].map(
        (callReturn) => ({
          ...callReturn,
          returnValues: callReturn['returnValues'].map((value) => {
            if (typeof value === 'object' && 'hex' in value)
              return web3.utils.hexToNumberString(value.hex)
            else return value
          })
        })
      )
    }))
    return results
  } catch (error) {
    throw {
      message: `MULTICALL_ERROR. ${error.message}`,
      error: error.message
    }
  }
}

module.exports = { multiCall }

// Example

// const contractCallContext = [
//     {
//       reference: 'BloodToken',
//       contractAddress: '0xc3b99c2a46b8DC82C96B8b61ED3A4c5E271164D7',
//       abi: [
//         {
//           inputs: [
//             { internalType: 'address', name: 'account', type: 'address' }
//           ],
//           name: 'balanceOf',
//           outputs: [
//             { internalType: 'uint256', name: '', type: 'uint256' }
//           ],
//           stateMutability: 'view',
//           type: 'function'
//         }
//       ],
//       calls: [
//         {
//           reference: 'bloodTokenBalance',
//           methodName: 'balanceOf',
//           methodParameters: [account]
//         }
//       ]
//     },
//     {
//       reference: 'MuonSwapPair',
//       contractAddress: '0xC233Cce22a0E7a5697D01Dcc6be93DA14BfB3761',
//       abi: [
//         {
//           inputs: [
//             { internalType: 'address', name: 'account', type: 'address' }
//           ],
//           name: 'balanceOf',
//           outputs: [
//             { internalType: 'uint256', name: '', type: 'uint256' }
//           ],
//           stateMutability: 'view',
//           type: 'function'
//         },
//         {
//           inputs: [],
//           name: 'symbol',
//           outputs: [{ internalType: 'string', name: '', type: 'string' }],
//           stateMutability: 'view',
//           type: 'function'
//         }
//       ],
//       calls: [
//         {
//           reference: 'muonSwapBalance',
//           methodName: 'balanceOf',
//           methodParameters: [account]
//         },
//         {
//           reference: 'muonSwapSymbol',
//           methodName: 'symbol'
//         }
//       ]
//     }
//   ]


/***/ }),

/***/ 108:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const Web3 = __webpack_require__(519)
const web3Instance = new Web3()

module.exports = function soliditySha3(params) {
    return web3Instance.utils.soliditySha3(...params)
}


/***/ }),

/***/ 623:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

//It is recommended to use ethers4.0.47 version
var ethers = __webpack_require__(982)
const TronWeb = __webpack_require__(643)
const Web3 = __webpack_require__(519);

// console.log(TronWeb.utils)

const AbiCoder = ethers.utils.AbiCoder;
const ADDRESS_PREFIX_REGEX = /^(41)/;
const ADDRESS_PREFIX = "41";

function encodeParams(inputs){
  let typesValues = inputs
  let parameters = ''

  if (typesValues.length == 0)
    return parameters
  const abiCoder = new AbiCoder();
  let types = [];
  const values = [];

  for (let i = 0; i < typesValues.length; i++) {
    let {type, value} = typesValues[i];
    if (type == 'address')
      value = value.replace(ADDRESS_PREFIX_REGEX, '0x');
    else if (type == 'address[]')
      value = value.map(v => toHex(v).replace(ADDRESS_PREFIX_REGEX, '0x'));
    types.push(type);
    values.push(value);
  }

  // console.log(types, values)
  try {
    parameters = abiCoder.encode(types, values).replace(/^(0x)/, '');
  } catch (ex) {
    console.log(ex);
  }
  return parameters

}

/**
 types:Parameter type list, if the function has multiple return values, the order of the types in the list should conform to the defined order
 output: Data before decoding
 ignoreMethodHash：Decode the function return value, fill falseMethodHash with false, if decode the data field in the gettransactionbyid result, fill ignoreMethodHash with true

 Sample: await decodeParams(['address', 'uint256'], data, true)
 */

async function decodeParams(types, output, ignoreMethodHash) {

  if (!output || typeof output === 'boolean') {
    ignoreMethodHash = output;
    output = types;
  }

  if (ignoreMethodHash && output.replace(/^0x/, '').length % 64 === 8)
    output = '0x' + output.replace(/^0x/, '').substring(8);

  const abiCoder = new AbiCoder();

  if (output.replace(/^0x/, '').length % 64)
    throw new Error('The encoded string is not valid. Its length must be a multiple of 64.');
  return abiCoder.decode(types, output).reduce((obj, arg, index) => {
    if (types[index] == 'address')
      arg = ADDRESS_PREFIX + arg.substr(2).toLowerCase();
    obj.push(arg);
    return obj;
  }, []);
}

function encodeSignature(signature, owner, nonce) {
  return "0x" + encodeParams([
    {type: "uint256", value: signature},
    {type: "uint256", value: owner},
    {type: "address", value: nonce},
  ])
}

function toEthAddress(address) {
  if(Web3.utils.isAddress(address))
    return address;
  if(!TronWeb.utils.crypto.isAddressValid(address))
    throw {message: `Invalid tron or eth address ${address}`}
  if(!TronWeb.utils.isHex(address))
    return Web3.utils.toChecksumAddress("0x" + TronWeb.address.toHex(address).substr(2, 40));
  else
    return address;
}

function soliditySha3(inputs) {
  inputs = inputs.map(({type, value}) => {
    if(type === 'address')
      return {type, value: toEthAddress(value)}
    else
      return {type, value}
  })
  return Web3.utils.soliditySha3(...inputs)
}

module.exports = {
  TronWeb,
  soliditySha3,
  encodeParams,
  toEthAddress,
  decodeParams,
  encodeSignature,
};


/***/ }),

/***/ 492:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
global.MuonAppUtils = __webpack_require__(577);
const { axios, soliditySha3, floatToBN } = global.MuonAppUtils;
exports["default"] = {
    APP_NAME: "webpack-test",
    onRequest: function (request) {
        return __awaiter(this, void 0, void 0, function* () {
            let { method, data: { params }, } = request;
            let message = params.message;
            switch (method) {
                case "echo":
                    // to test axios
                    let json = yield axios.get("http://echo.jsontest.com/key/" + message);
                    let value = json.data.key;
                    return { value };
                default:
                    throw { message: `Unknown method ${params}` };
            }
        });
    },
    signParams: function (request, result) {
        switch (request.method) {
            case "echo":
                let { value } = result;
                return [{ type: "string", value: value }];
            default:
                throw { message: "Nothing to sign" };
        }
    },
};


/***/ }),

/***/ 167:
/***/ ((module) => {

"use strict";
module.exports = require("axios");

/***/ }),

/***/ 215:
/***/ ((module) => {

"use strict";
module.exports = require("bignumber.js");

/***/ }),

/***/ 685:
/***/ ((module) => {

"use strict";
module.exports = require("eth-sig-util");

/***/ }),

/***/ 317:
/***/ ((module) => {

"use strict";
module.exports = require("ethereum-multicall");

/***/ }),

/***/ 567:
/***/ ((module) => {

"use strict";
module.exports = require("ethereumjs-util");

/***/ }),

/***/ 982:
/***/ ((module) => {

"use strict";
module.exports = require("ethers");

/***/ }),

/***/ 239:
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),

/***/ 517:
/***/ ((module) => {

"use strict";
module.exports = require("lodash");

/***/ }),

/***/ 643:
/***/ ((module) => {

"use strict";
module.exports = require("tronweb");

/***/ }),

/***/ 519:
/***/ ((module) => {

"use strict";
module.exports = require("web3");

/***/ }),

/***/ 352:
/***/ ((module) => {

"use strict";
module.exports = require("ws");

/***/ }),

/***/ 920:
/***/ ((module) => {

"use strict";
module.exports = JSON.parse('[{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]');

/***/ }),

/***/ 329:
/***/ ((module) => {

"use strict";
module.exports = JSON.parse('[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"MAX_SUPPLY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_count","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"_to","type":"address"},{"internalType":"address","name":"_tokenAddr","type":"address"}],"name":"ownerWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"_active","type":"bool"}],"name":"setActive","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"baseURI","type":"string"}],"name":"setBaseURI","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"walletOfOwner","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"}]');

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(492);
/******/ 	__webpack_exports__ = __webpack_exports__["default"];
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});