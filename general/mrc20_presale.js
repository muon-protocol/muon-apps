const { toBaseUnit, soliditySha3, BN, recoverTypedMessage, Web3, ethCall } =
  MuonAppUtils
const {
  ABI_userInfo,
  allocation,
  IDO_PARTICIPANT_TOKENS,
  chainMap,
  LockType,
  DEPOSIT_LOCK,
  PUBLIC_PHASE,
  MUON_PRICE
} = require('./mrc20_presale.constant.json')

const getTimestamp = () => Date.now()

const bn = (num) => new BN(num)

// the reason start_time is /1000 to be like contract and if it needs to read from contract other formula work correct
const START_TIME = 1659886200
//mainnet: 1659886200

const PUBLIC_TIME = START_TIME * 1000 + 5 * 24 * 3600 * 1000
const PUBLIC_SALE = START_TIME * 1000 + 3 * 24 * 3600 * 1000

function getTokens() {
  return {
    ert_d6: {
      decimals: 6,
      address: '0xfBB0Aa52B82dD2173D8ce97065b2f421216A312A',
      price: 1,
      chains: [97, 4]
    },
    ert: {
      decimals: 18,
      address: '0x701048911b1f1121E33834d3633227A954978d53',
      price: 1,
      chains: [80001]
    },
    usdc: {
      decimals: 6,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      price: 1,
      chains: [chainMap.ETH]
    },
    busd: {
      decimals: 18,
      address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      price: 1,
      chains: [chainMap.BSC]
    },
    matic_usdc: {
      decimals: 6,
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      price: 1,
      chains: [chainMap.MATIC]
    },
    ftm_usdc: {
      decimals: 6,
      address: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
      price: 1,
      chains: [chainMap.FTM]
    },
    arb_usdc: {
      decimals: 6,
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      price: 1,
      chains: [chainMap.ARBITRUM]
    },
    avax_usdc: {
      decimals: 6,
      address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
      price: 1,
      chains: [chainMap.AVAX]
    },
    op_usdc: {
      decimals: 6,
      address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      price: 1,
      chains: [chainMap.OPTIMISM]
    }
  }
}

const getDay = (time) =>
  Math.floor((time - START_TIME * 1000) / (24 * 3600 * 1000)) + 1

const MRC20Presale = {
  [chainMap.ETH]: '0x671B29e20d834dc27e2af3A717F2204d89aF9Cd7',
  [chainMap.BSC]: '0x671B29e20d834dc27e2af3A717F2204d89aF9Cd7',
  [chainMap.MATIC]: '0x671B29e20d834dc27e2af3A717F2204d89aF9Cd7',
  [chainMap.FTM]: '0x671B29e20d834dc27e2af3A717F2204d89aF9Cd7',
  [chainMap.ARBITRUM]: '0x671B29e20d834dc27e2af3A717F2204d89aF9Cd7',
  [chainMap.AVAX]: '0x671B29e20d834dc27e2af3A717F2204d89aF9Cd7',
  [chainMap.OPTIMISM]: '0x671B29e20d834dc27e2af3A717F2204d89aF9Cd7'
}

module.exports = {
  APP_NAME: 'mrc20_presale',

  readOnlyMethods: ['checkLock'],

  checkLock: async function (params) {
    const {
      params: { forAddress }
    } = params
    const allocationForAddress = allocation[forAddress]
    let currentTime = getTimestamp()

    if (!allocationForAddress && currentTime < PUBLIC_SALE) {
      return {
        message: `Allocation is 0 for your address.`,
        lockType: LockType.ALLOCATION,
        lock: true,
        lockTime: PUBLIC_SALE,
        expireAt: PUBLIC_SALE,
        PUBLIC_TIME,
        PUBLIC_SALE,
        START_TIME,
        day: getDay(currentTime)
      }
    }

    let lock = await this.readNodeMem({
      'data.name': DEPOSIT_LOCK,
      'data.value': forAddress
    })
    if (lock) {
      return {
        message: `Your address is locked. Please wait.`,
        lock: true,
        lockType: LockType.COOL_DOWN,
        lockTime: 5 * 60,
        expireAt: lock.expireAt,
        PUBLIC_TIME,
        PUBLIC_SALE,
        START_TIME,
        day: getDay(currentTime)
      }
    }
    return {
      message: `Not locked.`,
      lock: false,
      PUBLIC_TIME,
      PUBLIC_SALE,
      START_TIME,
      day: getDay(currentTime)
    }
  },

  validateDeposit: async function (params) {
    let { token, forAddress, amount, sign, chainId } = params

    chainId = parseInt(chainId)

    if (!token) throw { message: 'Invalid token' }
    if (!amount || parseInt(amount) === 0)
      throw { message: 'Invalid deposit amount' }
    if (!forAddress) throw { message: 'Invalid sender address' }
    if (!sign) throw { message: 'Invalid signature.' }
    if (!chainId || !Object.values(chainMap).includes(chainId))
      throw { message: 'Invalid chainId' }

    let typedData = {
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }],
        Message: [{ type: 'address', name: 'forAddress' }]
      },
      domain: { name: 'MRC20 Presale' },
      primaryType: 'Message',
      message: { forAddress: forAddress }
    }

    let signer = recoverTypedMessage({ data: typedData, sig: sign }, 'v4')
    if (signer.toLowerCase() !== forAddress.toLowerCase())
      throw { message: 'Request signature mismatch' }

    let allocationForAddress = allocation[forAddress]
    let currentTime = getTimestamp()

    if (allocationForAddress === undefined && currentTime < PUBLIC_SALE)
      throw { message: 'Allocation is 0 for your address.' }
    const day = getDay(currentTime)
    if (day <= 0) throw { message: 'No Active Sale' }

    let tokenList = await getTokens()
    if (!Object.keys(tokenList).includes(token.toLowerCase()))
      throw { message: 'Invalid token.' }

    token = tokenList[token.toLowerCase()]
    if (!token.chains.includes(chainId))
      throw { message: 'Token and chain is not matched.' }
  },

  validateRequest: async function(request) {
    const {method} = request
    switch (method) {
      case "deposit": {
        await this.validateDeposit(request.data.params)
      }
    }
  },

  onArrive: async function (request) {
    const {
      method,
      data: { params }
    } = request
    switch (method) {
      case 'deposit':
        const { forAddress } = params
        let currentTime = getTimestamp()

        let memory = [
          { type: 'uint256', name: DEPOSIT_LOCK, value: forAddress }
        ]
        let lock = await this.readNodeMem({
          'data.name': DEPOSIT_LOCK,
          'data.value': forAddress
        })
        if (lock) {
          throw {
            message: {
              message: `Your address is locked. Please wait.`,
              lockTime: 5 * 60,
              expireAt: lock.expireAt,
              day: getDay(currentTime)
            }
          }
        }
        await this.writeNodeMem(memory, 5 * 60)
        return

      default:
        break
    }
  },

  onRequest: async function (request) {
    let {
      method,
      data: { params }
    } = request

    switch (method) {
      case 'deposit':
        let { token, forAddress, amount, chainId } = params
        chainId = parseInt(chainId)

        let allocationForAddress = allocation[forAddress]
        let currentTime = getTimestamp()
        const day = getDay(currentTime)
        let tokenList = await getTokens()
        token = tokenList[token.toLowerCase()]
        let tokenPrice = toBaseUnit(token.price.toString(), 18)

        let baseToken = bn(10).pow(bn(token.decimals))
        let usdAmount = bn(amount).mul(tokenPrice).div(baseToken)
        let usdMaxCap = IDO_PARTICIPANT_TOKENS * MUON_PRICE
        let totalBalance = {}
        let purchasePromises = []

        for (let index = 0; index < Object.keys(chainMap).length; index++) {
          const chainId = chainMap[Object.keys(chainMap)[index]]
          purchasePromises.push(
            ethCall(
              MRC20Presale[chainId],
              'userInfo',
              [forAddress, 6],
              ABI_userInfo,
              chainId
            )
          )
        }
        let userInfo = await Promise.all(purchasePromises)
        for (let index = 0; index < Object.keys(chainMap).length; index++) {
          const chainId = chainMap[Object.keys(chainMap)[index]]
          totalBalance = {
            ...totalBalance,
            [chainId]: bn(userInfo[index]['_totalBalance'])
          }
        }
        let sum = Object.keys(totalBalance).reduce(
          (sum, chain) => sum.add(totalBalance[chain]),
          bn(0)
        )
        if (
          Number(Web3.utils.fromWei(usdAmount, 'ether')) +
            Number(Web3.utils.fromWei(sum, 'ether')) >
          usdMaxCap
        )
          throw { message: 'Amount is not valid' }

        let finalMaxCap
        if (currentTime >= PUBLIC_TIME) {
          finalMaxCap = toBaseUnit(usdMaxCap.toString(), 18).toString()
        } else {
          let allPurchase = {}

          for (let index = 0; index < Object.keys(chainMap).length; index++) {
            const chain = chainMap[Object.keys(chainMap)[index]]

            let amount = bn(0)

            switch (true) {
              case day < 4:
                amount =
                  chain != chainId
                    ? userInfo[index]['_userBalance']
                    : bn(userInfo[index]['_userBalance']).sub(
                        bn(userInfo[index]['_roundBalances'][day - 1])
                      )
                break
              case day === 4:
                amount =
                  chain != chainId
                    ? userInfo[index]['_roundBalances'][day - 1]
                    : 0
                break
              case day === 5:
                amount =
                  chain != chainId
                    ? bn(userInfo[index]['_roundBalances'][day - 2]).add(
                        bn(userInfo[index]['_roundBalances'][day - 1])
                      )
                    : bn(userInfo[index]['_roundBalances'][day - 2])
                        .add(bn(userInfo[index]['_roundBalances'][day - 1]))
                        .sub(bn(userInfo[index]['_roundBalances'][day - 1]))
                break
              default:
                break
            }

            allPurchase = {
              ...allPurchase,
              [chain]: bn(amount)
            }
          }

          let sum = Object.keys(allPurchase).reduce(
            (sum, chain) => sum.add(allPurchase[chain]),
            bn(0)
          )
          let allocation =
            currentTime < PUBLIC_SALE
              ? allocationForAddress[day]
              : PUBLIC_PHASE[day]

          let maxCap = bn(toBaseUnit(allocation.toString(), 18).toString())
          finalMaxCap = maxCap.sub(sum).toString()
        }

        if (finalMaxCap <= 0) throw { message: 'Final maxCap is not valid' }

        const data = {
          token: token.address,
          forAddress,
          day,
          extraParameters: [
            finalMaxCap,
            chainId,
            tokenPrice.toString(),
            amount,
            request.data.timestamp
          ]
        }
        // let lock = await this.readNodeMem(
        //   { 'data.name': DEPOSIT_LOCK, 'data.value': forAddress },
        //   { distinct: 'owner' }
        // )
        // if (lock.length !== 1) throw { message: 'Atomic run failed.' }

        return data

      default:
        throw { message: `Unknown method ${params}` }
    }
  },

  hashRequestResult: function (request, result) {
    let { method } = request

    switch (method) {
      case 'deposit':
        let { token, day, forAddress, extraParameters } = result

        return soliditySha3([
          { type: 'uint32', value: this.APP_ID },
          { type: 'address', value: token },
          { type: 'uint8', value: day },
          { type: 'uint256', value: extraParameters[3] },
          { type: 'uint256', value: request.data.timestamp },
          { type: 'address', value: forAddress },
          { type: 'uint256', value: extraParameters[0] },
          { type: 'uint256', value: extraParameters[1] },
          { type: 'uint256', value: extraParameters[2] }
        ])

      default:
        return null
    }
  }
}
