const { ethers, network } = require("hardhat")

const delay = (delayInms) => {
    return new Promise((resolve) => setTimeout(resolve, delayInms))
}

async function mockKeepers() {
    const casino = await ethers.getContract("CasinoV1")
    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
    const { upkeepNeeded } = await casino.callStatic.checkUpkeep(checkData)
    if (upkeepNeeded) {
        const tx = await casino.performUpkeep(checkData)
        const txReceipt = await tx.wait(1)
        const requestId = txReceipt.events[1].args.requestId
        console.log(`Performed upkeep with RequestId: ${requestId}`)
        if (network.config.chainId == 31337) {
            console.log("Waiting...")
            await delay(40000)
            await mockVrf(requestId, casino)
        }
    } else {
        console.log("No upkeep needed!")
    }
}

async function mockVrf(requestId, casino) {
    console.log("We on a local network? Ok let's pretend...")
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, casino.address)
    console.log("Responded!")
    const recentWinner = await casino.getRecentWinner()
    console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
