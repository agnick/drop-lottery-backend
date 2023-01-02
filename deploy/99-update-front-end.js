const fs = require("fs")
const { network, ethers } = require("hardhat")

const FRONT_END_ADRESSES_FILE = "../nextjs-drop/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-drop/constants/abi.json"

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating front end...")
        await updateContractAddresses()
        await updateAbi()
    }
}

async function updateContractAddresses() {
    const casino = await ethers.getContract("CasinoV1")
    const chainId = network.config.chainId.toString()
    const currentAdresses = JSON.parse(fs.readFileSync(FRONT_END_ADRESSES_FILE, "utf8"))
    if (chainId in currentAdresses) {
        if (!currentAdresses[chainId].includes(casino.address)) {
            currentAdresses[chainId].push(casino.address)
        }
    }
    {
        currentAdresses[chainId] = [casino.address]
    }
    fs.writeFileSync(FRONT_END_ADRESSES_FILE, JSON.stringify(currentAdresses))
}

async function updateAbi() {
    const casino = await ethers.getContract("CasinoV1")
    fs.writeFileSync(FRONT_END_ABI_FILE, casino.interface.format(ethers.utils.FormatTypes.json))
}

module.exports.tags = ["all", "frontend"]
