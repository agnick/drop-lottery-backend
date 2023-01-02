const networkConfig = {
    // hardhat test network
    31337: {
        name: "hardhat",
        entranceFee: "100000000000000000", // 0.1 eth
        keepersInterval: "30", // 30 sec
        vrfCoordinator: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        linkAddress: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
        subscriptionId: "0", // not needed
        keyHash: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        callbackGasLimit: "500000", // 500,000 gas
    },
    5: {
        name: "goerli",
        entranceFee: "1000000000000000", // 0.001 eth
        keepersInterval: "30", // 30 sec
        vrfCoordinator: "0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d",
        linkAddress: "0x326c977e6efc84e512bb9c30f76e30c160ed06fb",
        subscriptionId: "1775",
        keyHash: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        callbackGasLimit: "500000", // 500,000 gas
    },
    80001: {
        name: "mumbai",
        entranceFee: "10000000000000000", // 0.01 eth
        keepersInterval: "30", // 30 sec
        vrfCoordinator: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
        linkAddress: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
        subscriptionId: "2361",
        keyHash: "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f",
        callbackGasLimit: "500000", // 500,000 gas
    },
    1: {
        name: "mainnet",
        entranceFee: "1000000000000000", // 0.001 eth
        keepersInterval: "172800", // 2 days
        vrfCoordinator: "0x271682DEB8C4E0901D1a1550aD2e64D568E69909",
        linkAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
        subscriptionId: "579",
        keyHash: "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef",
        callbackGasLimit: "500000", // 500,000 gas
    },
}

const DEVELOPMENT_CHAINS = ["localhost", "hardhat"]

module.exports = {
    networkConfig,
    DEVELOPMENT_CHAINS,
}
