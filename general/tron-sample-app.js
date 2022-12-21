const {tron} = MuonAppUtils
const TssApp = {
  APP_NAME: 'tron-sample',
  // APP_ID: '5007',

  onRequest: async function (request) {
    throw { message: `MuonApp disabled.` }
    let {method, data: {params={}}} = request;
    switch (method) {
      case 'verify_string':
        if(!params.str)
          throw "params[str]: undefined"
        return params.str;
      case 'verify_string_int':
        if(!params.str || !params.int)
          throw "params[str|int]: undefined"
        return {
          str: params.str,
          int: params.int
        };
      case 'verify_string_int_address':
        if(!params.str || !params.int || !params.address)
          throw "params[str|int|address]: undefined"
        return {
          str: params.str,
          int: params.int,
          address: params.address,
        };
      default:
        throw {message: `invalid method ${method}`}
    }
  },

  hashRequestResult: function (request, result){
    switch (request.method) {
      case 'verify_string':
        return tron.soliditySha3([
          {type: 'uint32', value: this.APP_ID},
          {type: 'string', value: result.toString()},
        ]);
      case 'verify_string_int':
        return tron.soliditySha3([
          {type: 'uint32', value: this.APP_ID},
          {type: 'string', value: result.str},
          {type: 'uint256', value: result.int},
        ]);
      case 'verify_string_int_address':
        return tron.soliditySha3([
          {type: 'uint32', value: this.APP_ID},
          {type: 'string', value: result.str},
          {type: 'uint256', value: result.int},
          {type: 'address', value: result.address},
        ]);
      default:
        throw { message: `Unknown method: ${request.method}` }
    }
  },
}

module.exports = TssApp
