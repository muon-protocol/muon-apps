const { axios, toBaseUnit, soliditySha3, timeout } = MuonAppUtils

const COINDESK_API = 'https://api.coindesk.com/v1/bpi/currentprice/BTC.json'

function getBtcPrice() {
  return axios.get(COINDESK_API).then(({ data }) => data)
}
const getTimestamp = () => Math.floor(Date.now() / 1000)

const LOCK_NAME = "sample-app-lock-user"

module.exports = {
  APP_NAME: 'sample',
  dependencies: ['redis'],
  isService: true,

  /**
   * Methods that run only on the current node.
   * returned value will return to client.
   */
  readOnlyMethods: [
    'myReadOnlyMethod',
    'invokeTestMethod',
  ],

  myReadOnlyMethod: async function({params}){
    return {
      message: "sample readonly method",
      data: [
        "value 0",
        "value 1"
      ]
    }
  },

  invokeTestMethod: async function({params}) {
    let request = {
      method: 'call',
      data: {
        params:{
          address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
          method: "name",
          params: [],
          abi: [{"constant": true, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "payable": false, "stateMutability": "view", "type": "function"}],
          network: 'eth',
        }
      }
    };
    let invokeResult = await this.invoke("eth", "onRequest", request);
    return {
      params,
      result: invokeResult
    }
  },

  /**
   * App initialization hook
   * @returns {Promise<void>}
   */
  onAppInit: async function (){
  },

  /**
   * Run on all nodes before onRequest
   * on the gateway node runs before onArrive
   * @param request
   * @returns {Promise<void>}
   */
  validateRequest: async function(request) {
    const {method} = request
    switch (method) {
      case "test-method": {
        /**
         * Do your method validation here
         */
      }
    }
  },

  /**
   * Request arrival hook
   * Runs only on the first node
   *
   * @param request
   * @returns {Promise<void>}
   */
  onArrive: async function (request) {
    let {method, data: {params}} = request;
    switch (method) {
      case 'lock-1':
        let {user} = params;

        /**
         * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         *  Do all request validations here to prevent incorrect lock. *
         * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         */

        // looking for data in memory
        let lock = await this.readNodeMem(`user-lock-${user}`)
        if (lock) {
          throw {message: `User [${user}] locked for a moment`}
        }

        // Write to memory
        await this.writeNodeMem(`user-lock-${user}`, [{type: 'bool', value: true}], 120);

        // wait for memory write confirmation
        await timeout(1000);

        break;
    }
  },

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request
    switch (method) {
      case 'test_speed': {
        return 'speed test done.'
      }

      case 'test_redis':{
        let previews = await this.redis.get('last-exec-time');
        let current = `${Math.floor(Date.now()/1000)}`
        this.redis.set("last-exec-time", current);
        return "done";
      }

      case 'test_memory': {
        let { user } = params
        return `Data stored in memory for user: ${user}`
      }

      case 'lock-1': {
        let {user} = params
        return 'lock done.'
      }

      case 'lock-2': {
        let {user} = params
        /** Atomic locally read and write */
        const alreadyLocked = await this.writeLocalMem(`lock-${user}`, [{type: "bool", value: true}], 120, {getset: true})
        if(alreadyLocked)
          throw `user locked`;
        return 'lock done.'
      }

      case 'btc_price': {
        let result = await getBtcPrice()
        let price = toBaseUnit(
          result.bpi.USD.rate_float.toString(),
          18
        ).toString()
        let time = getTimestamp()

        return {
          time,
          price,
          price_float: result.bpi.USD.rate_float
        }
      }

      default:
        return 'test done'
    }
  },

  signParams: function (request, result) {
    // console.log(result)
    switch (request.method) {
      case 'test_speed':
      case 'test_redis':
      case 'test_memory':
      case 'lock-1':
      case 'lock-2':
        return [{type: 'string', value: result}]
      case 'btc_price':
        return [
          { type: 'uint256', value: request.data.result.time },
          { type: 'uint256', value: result.price }
        ]
      default:
        throw { message: `Unknown method: ${request.method}` }
    }
  },

  /**
   * store data on request confirm
   */
  onMemWrite: function (req, res) {
    if (req.method === 'test_memory') {
      let {
        data: {
          params: { user }
        }
      } = req
      return {
        key: "sample-key",
        ttl: 10,
        data: [{ name: 'lock', type: 'string', value: user }]
      }
    }
  }
}
