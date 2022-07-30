const { toBaseUnit, soliditySha3, BN, recoverTypedMessage, Web3, ethCall } =
  MuonAppUtils
const {
  ABI_roundBalances,
  ABI_totalBalance,
  allocation,
  IDO_PARTICIPANT_TOKENS,
  chainMap,
  LockType,
  DEPOSIT_LOCK,
  PUBLIC_PHASE,
  MUON_PRICE
} = require('./mrc20_presale.constant.json')

const getTimestamp = () => Date.now()

// the reason start_time is /1000 to be like contract and if it needs to read from contract other formula work correct
const START_TIME = 1659331182

const PUBLIC_TIME = START_TIME * 1000 + 6 * 24 * 3600 * 1000
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
    }
  }
}

const getDay = (time) =>
  (Math.floor((time - START_TIME * 1000) / (24 * 3600 * 1000)) + 1).toString()

const MRC20Presale = {
  [chainMap.ETH]: '0xe769eB67d024D53EE29DC688b430F6f35F5c2F8e',
  [chainMap.BSC]: '0xf3FedAa069b4553046f4dafAf0Ec273036C5972b',
  [chainMap.MATIC]: '0x10b09c7EE431C477267f85b27dA7C1D230715E51'
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
        let { token, forAddress, amount, sign, chainId } = params
        chainId = Number(chainId)
        // TODO use await out  side of for
        if (!token) throw { message: 'Invalid token' }
        if (!amount || parseInt(amount) === '0')
          throw { message: 'Invalid deposit amount' }
        if (typeof amount !== 'string')
          throw { message: 'amount must be string' }
        if (!forAddress) throw { message: 'Invalid sender address' }
        if (!sign) throw { message: 'Invalid signature.' }
        if (!chainId) throw { message: 'Invalid chainId' }
        let allocationForAddress = allocation[forAddress]
        let currentTime = getTimestamp()

        if (allocationForAddress === undefined && currentTime < PUBLIC_SALE)
          throw { message: 'Allocation is 0 for your address.' }
        const day = getDay(currentTime)
        let tokenList = await getTokens()
        if (!Object.keys(tokenList).includes(token.toLowerCase()))
          throw { message: 'Invalid token.' }

        token = tokenList[token.toLowerCase()]
        if (!token.chains.includes(chainId))
          throw { message: 'Token and chain is not matched.' }

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

        let tokenPrice = toBaseUnit(token.price.toString(), 18)
        let finalMaxCap
        if (currentTime < PUBLIC_SALE) {
          allocationForAddress = allocationForAddress[day]
          let maxCap = new BN(
            toBaseUnit(allocationForAddress.toString(), 18).toString()
          )
          let allPurchase = {}
          for (let index = 0; index < Object.keys(chainMap).length; index++) {
            const chainId = chainMap[Object.keys(chainMap)[index]]
            let purchase = await ethCall(
              MRC20Presale[chainId],
              'roundBalances',
              [forAddress, day],
              ABI_roundBalances,
              chainId
            )
            allPurchase = { ...allPurchase, [chainId]: new BN(purchase) }
          }
          let sum = Object.keys(allPurchase)
            .filter((chain) => chain != chainId)
            .reduce((sum, chain) => sum.add(allPurchase[chain]), new BN(0))
          finalMaxCap = maxCap.sub(sum).toString()
        } else if (currentTime >= PUBLIC_SALE && currentTime < PUBLIC_TIME) {
          let maxCap = new BN(
            toBaseUnit(PUBLIC_PHASE[day].toString(), 18).toString()
          )
          let allPurchase = {}
          for (let index = 0; index < Object.keys(chainMap).length; index++) {
            const chainId = chainMap[Object.keys(chainMap)[index]]
            let purchase = await ethCall(
              MRC20Presale[chainId],
              'roundBalances',
              [forAddress, day],
              ABI_roundBalances,
              chainId
            )
            allPurchase = { ...allPurchase, [chainId]: new BN(purchase) }
          }
          let sum = Object.keys(allPurchase)
            .filter((chain) => chain != chainId)
            .reduce((sum, chain) => sum.add(allPurchase[chain]), new BN(0))
          finalMaxCap = maxCap.sub(sum).toString()
        } else {
          let totalBalance = {}
          for (let index = 0; index < Object.keys(chainMap).length; index++) {
            const chainId = chainMap[Object.keys(chainMap)[index]]
            let purchase = await ethCall(
              MRC20Presale[chainId],
              'totalBalance',
              [],
              ABI_totalBalance,
              chainId
            )
            totalBalance = { ...totalBalance, [chainId]: new BN(purchase) }
          }
          let sum = Object.keys(totalBalance).reduce(
            (sum, chain) => sum.add(totalBalance[chain]),
            new BN(0)
          )

          let baseToken = new BN(10).pow(new BN(token.decimals))
          let usdAmount = new BN(amount).mul(tokenPrice).div(baseToken)
          let usdMaxCap = IDO_PARTICIPANT_TOKENS * MUON_PRICE
          if (
            Number(Web3.utils.fromWei(usdAmount, 'ether')) +
              Number(Web3.utils.fromWei(sum, 'ether')) >
            usdMaxCap
          )
            throw { message: 'Amount is not valid' }
          finalMaxCap = toBaseUnit(usdMaxCap.toString(), 18).toString()
        }
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
        let lock = await this.readNodeMem(
          { 'data.name': DEPOSIT_LOCK, 'data.value': forAddress },
          { distinct: 'owner' }
        )
        if (lock.length !== 1) throw { message: 'Atomic run failed.' }

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
