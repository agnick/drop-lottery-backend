require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL
const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL
const PRIVATE_KEY_0 = process.env.PRIVATE_KEY_0
const PRIVATE_KEY_1 = process.env.PRIVATE_KEY_1
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.9",
            },
            {
                version: "0.8.12",
            },
        ],
    },
    defaultNetwork: "hardhat",
    networks: {
        localhost: {
            chainId: 31337,
        },
        mainnet: {
            chainId: 1,
            saveDeployments: true,
            url: MAINNET_RPC_URL,
            accounts: [PRIVATE_KEY_0, PRIVATE_KEY_1],
        },
        hardhat: {
            chainId: 31337,
            allowUnlimitedContractSize: true,
            blockConfirmations: 1,
        },
        goerli: {
            chainId: 5,
            allowUnlimitedContractSize: true,
            saveDeployments: true,
            url: GOERLI_RPC_URL,
            accounts: [PRIVATE_KEY_0, PRIVATE_KEY_1],
        },
        mumbai: {
            chainId: 80001,
            allowUnlimitedContractSize: true,
            saveDeployments: true,
            url: MUMBAI_RPC_URL,
            accounts: [PRIVATE_KEY_0, PRIVATE_KEY_1],
        },
    },
    contractSizer: {
        runOnCompile: false,
        only: ["CasinoV1"],
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    gasReporter: {
        enabled: true,
        outputFile: "gas-report.txt",
        noColors: true,
        currency: "USD",
        coinmarketcap: COINMARKETCAP_API_KEY,
        token: "ETH",
    },
    mocha: {
        timeout: 5000000, // 500 seconds max
    },
    etherscan: {
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
            mainnet: ETHERSCAN_API_KEY,
            polygonMumbai: POLYGONSCAN_API_KEY,
        },
    },
}
