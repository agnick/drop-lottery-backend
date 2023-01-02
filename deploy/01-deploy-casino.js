const { network, ethers } = require("hardhat")
const { DEVELOPMENT_CHAINS, networkConfig } = require("../hardhat-helper-config")
const { verify } = require("../utils/verify")

// 1000 eth -> ethereum amount for VRF test subscription (mocks)
const FUND_AMOUNT_VRF_SUB_MOCKS = "1000000000000000000000"
// 5 LINK -> link token amount needed for real VRF subscription
const FUND_AMOUNT_VRF_SUB = "5000000000000000000"

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deployer } = await getNamedAccounts()
    const { deploy, log } = deployments
    const chainId = network.config.chainId
    // vrfCoordinatorV2Mock is a VRFCoordinatorV2Mock contract (mocks for testing)
    // vrfCoordinatorV2 is an address of VRF coordinator (changing depending on the current network)
    // subscriptionId is an ID of the chainlink VRF subscription (changing depending on the current network)
    let vrfCoordinatorV2Mock, vrfCoordinatorV2, subscriptionId

    // First we need to check wich network we're on
    // If we're on a development network mocks will be used
    if (DEVELOPMENT_CHAINS.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2 = vrfCoordinatorV2Mock.address
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait()
        subscriptionId = transactionReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT_VRF_SUB_MOCKS)
    } else {
        vrfCoordinatorV2 = networkConfig[chainId]["vrfCoordinator"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    // CasinoV1 constructor arguments
    const args = [
        networkConfig[chainId]["entranceFee"],
        networkConfig[chainId]["keepersInterval"],
        vrfCoordinatorV2,
        networkConfig[chainId]["linkAddress"],
        subscriptionId,
        networkConfig[chainId]["keyHash"],
        networkConfig[chainId]["callbackGasLimit"],
        FUND_AMOUNT_VRF_SUB,
    ]

    // Deploying CasinoV1 contract
    const casino = await deploy("CasinoV1", {
        from: deployer,
        log: true,
        args: args,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log(`Casino deployed at ${casino.address}. Current network is ${network.name}`)
    log("-------------------------------------------------------")

    // Adding consumer if we're on development network
    if (DEVELOPMENT_CHAINS.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer("1", casino.address)
    }

    // Verifying contract on etherscan
    if (!DEVELOPMENT_CHAINS.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(casino.address, args)
    }
}

module.exports.tags = ["all", "casino"]
