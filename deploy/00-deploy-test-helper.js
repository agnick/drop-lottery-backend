const { network, ethers } = require("hardhat")
const { DEVELOPMENT_CHAINS } = require("../hardhat-helper-config")

// 0.25
const BASE_FEE = ethers.utils.parseEther("0.25")
// 0.000000001 LINK per gas
const GAS_PRICE_LINK = 1e9

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deployer } = await getNamedAccounts()
    const { deploy, log } = deployments
    const args = [BASE_FEE, GAS_PRICE_LINK]

    // Deploy script in processing...
    if (DEVELOPMENT_CHAINS.includes(network.name)) {
        log("Local network detected! Deploying mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: args,
            log: true,
        })
        log("Mocks deployed!")
        log("-------------------------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
