const { assert, expect } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { DEVELOPMENT_CHAINS, networkConfig } = require("../../hardhat-helper-config")

!DEVELOPMENT_CHAINS.includes(network.name)
    ? describe.skip
    : describe("Casino Unit Test", function () {
          let chainId,
              accounts,
              deployer,
              player,
              casino,
              casinoContract,
              vrfCoordinatorV2Mock,
              entranceFee,
              interval

          beforeEach(async () => {
              chainId = network.config.chainId
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["all"])
              casinoContract = await ethers.getContract("CasinoV1", deployer)
              casino = casinoContract.connect(player)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              entranceFee = await casino.getEntranceFee()
              interval = await casino.getInterval()
          })

          describe("constructor", function () {
              it("inizializes the casino correctly", async () => {
                  const casinoState = await casino.getCasinoState()
                  assert.equal(casinoState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["keepersInterval"])
                  assert.equal(entranceFee.toString(), networkConfig[chainId]["entranceFee"])
              })
          })

          describe("enter", function () {
              it("reverts if eth amount isn't equal to entrance fee multiplied by tickets amounts", async () => {
                  await expect(casino.enter(1)).to.be.revertedWith("CasinoV1__PayEnoughEthereum")
                  await expect(casino.enter(2, { value: entranceFee })).to.be.revertedWith(
                      "CasinoV1__PayEnoughEthereum"
                  )
              })

              it("revert if casino state isn't 'OPEN'", async () => {
                  await casino.enter(1, { value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await casino.performUpkeep([])
                  await expect(casino.enter(1, { value: entranceFee })).to.be.revertedWith(
                      "CasinoV1__NotOpen"
                  )
              })

              it("adds player to players list on enter", async () => {
                  await casino.enter(2, { value: entranceFee.mul(2) })
                  const enteredPlayer = await casino.getPlayerByTicket(1)
                  assert.equal(enteredPlayer, player.address)
              })

              it("emits 'Entered' event correctly", async () => {
                  await expect(casino.enter(1, { value: entranceFee })).to.emit(casino, "Entered")
              })
          })

          describe("checkUpkeep", function () {
              it("returns false if casino state isn't 'OPEN'", async () => {
                  await casino.enter(1, { value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await casino.performUpkeep([])
                  const casinoState = await casino.getCasinoState()
                  const { upkeepNeeded } = await casino.callStatic.checkUpkeep([])
                  assert.equal(casinoState.toString(), "1")
                  assert(!upkeepNeeded)
              })

              it("returns false if there're no players and balance is '0'", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await casino.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })

              it("returns false if enough time hasn't passed", async () => {
                  await casino.enter(1, { value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 2])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await casino.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })

              it("returns true if completely fulfilled", async () => {
                  await casino.enter(1, { value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await casino.callStatic.checkUpkeep([])
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", function () {
              it("could be only called if upkeepNeeded is true", async () => {
                  await casino.enter(1, { value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const tx = await casino.performUpkeep([])
                  assert(tx)
              })

              it("reverts if upkeepNeeded is false", async () => {
                  await expect(casino.performUpkeep([])).to.be.revertedWith(
                      "CasinoV1__UpkeepIsFalse"
                  )
              })

              it("updates the casino state", async () => {
                  await casino.enter(1, { value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await casino.performUpkeep([])
                  const casinoState = await casino.getCasinoState()
                  assert.equal(casinoState.toString(), "1")
              })

              it("emits 'RandomRequested' correctly", async () => {
                  await casino.enter(1, { value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const transactionResponse = await casino.performUpkeep([])
                  const transactionReceipt = await transactionResponse.wait(1)
                  const requestId = await transactionReceipt.events[1].args.requestId
                  assert(requestId.toNumber() > 0)
              })
          })

          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await casino.enter(1, { value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
              })

              it("can only be called after performUpkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, casino.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, casino.address)
                  ).to.be.revertedWith("nonexistent request")
              })

              it("picks winner, resets variables and sends money", async () => {
                  const additionalEntrances = 3
                  const startingIndex = 2
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      const accountConnectedCasino = casino.connect(accounts[i])
                      await accountConnectedCasino.enter(1, { value: entranceFee })
                  }
                  const startingTimeStamp = await casino.getLastTimeStamp()

                  await new Promise(async (resolve, reject) => {
                      casino.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              const recentWinner = await casino.getRecentWinner()
                              const casinoState = await casino.getCasinoState()
                              const winnerBalance = await accounts[2].getBalance()
                              const ownerBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await casino.getLastTimeStamp()
                              await expect(casino.getPlayerByTicket(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[2].address)
                              assert.equal(casinoState.toString(), "0")
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingWinnerBalance
                                      .add(contractBalance.sub(ownerCommision))
                                      .toString()
                              )
                              assert(ownerBalance.gt(startingOwnerBalance))
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              reject(error)
                          }
                      })

                      const tx = await casino.performUpkeep([])
                      const txReceipt = await tx.wait(1)
                      const startingWinnerBalance = await accounts[2].getBalance()
                      const startingOwnerBalance = await accounts[0].getBalance()
                      const contractBalance = await casino.getContractBalance()
                      const ownerCommision = contractBalance.mul(5).div(100)
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          casino.address
                      )
                  })
              })
          })

          describe("getSubscription", function () {
              it("subscription is correct", async () => {
                  const subscription = await casino.getSubscription()
                  assert.equal(subscription.balance.toString(), ethers.utils.parseEther("1000"))
                  assert.equal(subscription.owner, deployer.address)
                  assert.equal(subscription.consumers[0], casino.address)
              })
          })
      })
