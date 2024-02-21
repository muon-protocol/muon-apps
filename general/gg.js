const { BigNumber } = require("ethers")

const { soliditySha3, ethCall } = MuonAppUtils

const getTimestamp = () => Math.floor(Date.now() / 1000)

const LGE_ABI = [{
	"inputs": [],
	"name": "totalSoldToken",
	"outputs": [
		{
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		}
	],
	"stateMutability": "view",
	"type": "function"
},
{
	"inputs": [
		{
			"internalType": "uint256",
			"name": "amount",
			"type": "uint256"
		},
		{
			"internalType": "uint256",
			"name": "ratio",
			"type": "uint256"
		}
	],
	"name": "amountsOut",
	"outputs": [
		{
			"internalType": "uint256",
			"name": "usdAmount",
			"type": "uint256"
		},
		{
			"internalType": "uint256",
			"name": "liquidAmount",
			"type": "uint256"
		},
		{
			"internalType": "uint256",
			"name": "lockedAmount",
			"type": "uint256"
		}
	],
	"stateMutability": "view",
	"type": "function"
}]

const LGE_ADDRESSES = {
	137: '0x16e7923e8b2DC378f366ED597514b90237C4C50f'
}

const total = BigNumber.from(6.6e6) * BigNumber.from(10).pow(18)

const TssApp = {
	APP_NAME: 'gg',
	useTss: true,

	onRequest: async function (request) {
		let { method, data: { params = {} } } = request;
		switch (method) {
			case 'lge': {
				let { amount, ratio, timestamp } = params

				const amountsOut = await ethCall(
					Object.values(LGE_ADDRESSES)[0],
					'amountsOut',
					[amount, ratio],
					LGE_ABI,
					Object.keys(LGE_ADDRESSES)[0]
				)
				let currentTotal = amountsOut.liquidAmount + amountsOut.lockedAmount;

				for (const chainId of Object.keys(LGE_ADDRESSES)) {

					currentTotal += await ethCall(
						LGE_ADDRESSES[chainId],
						'totalSoldToken',
						[],
						LGE_ABI,
						chainId
					)
				}

				if (timestamp > getTimestamp()) throw { message: 'Invalid Timestamp' }

				if (currentTotal > total) throw { message: 'Cap Reached' }

				return true;
			}
			default:
				throw { message: `invalid method ${method}` }
		}
	},

	signParams: function (request, result) {
		switch (request.method) {
			case 'lge':
				const { amount, ratio, timestamp } = request.data.params;
				return [
					{ type: 'uint256', value: amount },
					{ type: 'uint256', value: ratio },
					{ type: 'uint256', value: timestamp }
				]
			default:
				throw { message: `Unknown method: ${request.method}` }
		}
	}
}

module.exports = TssApp
