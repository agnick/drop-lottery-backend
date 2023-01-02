const { assert, expect } = require("chai")
const { network, ethers, getNamedAccounts } = require("hardhat")
const { DEVELOPMENT_CHAINS, networkConfig } = require("../../hardhat-helper-config")

DEVELOPMENT_CHAINS.includes(network.name)
    ? describe.skip
    : describe("Casino Staging Test", function () {
          let chainId, deployer, casino, entranceFee, linkFundAmount, linkToken

          beforeEach(async () => {
              chainId = network.config.chainId
              deployer = (await getNamedAccounts()).deployer
              casino = await ethers.getContract("CasinoV1", deployer)
              entranceFee = await casino.getEntranceFee()
              linkFundAmount = ethers.utils.parseEther("5")
              linkToken = await ethers.getContractAt(
                  "LinkTokenInterface",
                  networkConfig[chainId]["linkAddress"],
                  deployer
              )
          })

          describe("getSubscription", function () {
              it("returns correct subscription", async () => {
                  const subscription = await casino.getSubscription()
                  assert(subscription.balance.gt(0))
                  assert.equal(subscription.owner, deployer)
                  assert.equal(subscription.consumers[0], casino.address)
              })
          })

          describe("fulfillRandomWords", function () {
              it("works with live chainlink VRF and keepers", async () => {
                  console.log("Setting up test...")
                  const accounts = await ethers.getSigners()
                  const startingTimeStamp = await casino.getLastTimeStamp()
                  const subscriptionBalance = (await casino.getSubscription()).balance
                  if (subscriptionBalance.lt(linkFundAmount)) {
                      const startingLinkContractBalance = await linkToken.balanceOf(casino.address)
                      await linkToken.approve(deployer, linkFundAmount, { from: deployer })
                      console.log("Funding contract with LINK...")
                      const tx = await linkToken.transferFrom(
                          deployer,
                          casino.address,
                          linkFundAmount
                      )
                      await tx.wait(1)
                      const endinglinkContractBalance = await linkToken.balanceOf(casino.address)
                      assert.equal(
                          endinglinkContractBalance.toString(),
                          startingLinkContractBalance.add(linkFundAmount).toString()
                      )
                  }
                  console.log("Setting up listener...")
                  await new Promise(async (resolve, reject) => {
                      casino.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              const recentWinner = await casino.getRecentWinner()
                              const casinoState = await casino.getCasinoState()
                              const winnerBalance = await accounts[1].getBalance()
                              const ownerBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await casino.getLastTimeStamp()
                              await expect(casino.getPlayerByTicket(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[1].address)
                              assert.equal(casinoState.toString(), "0")
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingWinnerBalance
                                      .add(contractBalance.sub(ownerCommision))
                                      .toString()
                              )
                              assert.equal(
                                  ownerBalance.toString(),
                                  startingOwnerBalance.add(ownerCommision).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })
                      console.log("Entering the casino...")
                      const txEnter = await casino
                          .connect(accounts[1])
                          .enter(5, { value: entranceFee.mul(5) })
                      await txEnter.wait(1)
                      console.log("Entered!")
                      const startingWinnerBalance = await accounts[1].getBalance()
                      const startingOwnerBalance = await accounts[0].getBalance()
                      const contractBalance = await casino.getContractBalance()
                      console.log(contractBalance)
                      const ownerCommision = contractBalance.mul(5).div(100)
                      console.log("Processing...")
                  })
              })
          })
      })
