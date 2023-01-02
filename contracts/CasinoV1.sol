// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

error CasinoV1__PayEnoughEthereum();
error CasinoV1__NotOpen();
error CasinoV1__UpkeepIsFalse(uint256 currentBalance, uint256 playersNumber, uint256 casinoState);
error CasinoV1__TransferFailed();
error CasinoV1__NotOwner();

/**@title Casino Contract
 * @author Agnick
 * @notice This contract is for creating a casino contract
 * @dev Using VRFConsumerBaseV2 and KeeperCompatibleInterface
 */
contract CasinoV1 is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Type declarations */
    enum CasinoStates {
        OPEN,
        PROCESSING
    }
    /* State Variables */
    address payable private i_owner;
    // Chainlink vrf
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint256 private immutable i_vrfSubFundAmount;
    uint64 private immutable i_subId;
    bytes32 private immutable i_keyHash;
    uint16 private constant MIN_REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;
    // Chainlink LINKTOKEN
    LinkTokenInterface private immutable i_linkToken;
    // Lottery variables
    CasinoStates private s_casinoState;
    address payable[] private s_casinoPlayers;
    address payable private s_winner;
    uint256 private immutable i_entranceFee;
    uint256 private immutable i_interval;
    uint256 private s_lastTimeStamp;

    /* Events */
    event Entered(address indexed player, uint256 indexed ticketsAmount);
    event RandomRequested(uint256 indexed requestId);
    event WinnerPicked(address indexed winner, uint256 indexed winnerReward);

    /* Constructor */
    constructor(
        uint256 entranceFee,
        uint256 interval,
        address vrfCoordinator,
        address link,
        uint64 subId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint256 vrfSubFundAmount
    ) VRFConsumerBaseV2(vrfCoordinator) {
        i_owner = payable(msg.sender);
        s_casinoState = CasinoStates.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_entranceFee = entranceFee;
        i_interval = interval;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinator);
        i_linkToken = LinkTokenInterface(link);
        i_subId = subId;
        i_keyHash = keyHash;
        i_callbackGasLimit = callbackGasLimit;
        i_vrfSubFundAmount = vrfSubFundAmount;
    }

    /**
     * @notice Allows players to buy tickets.
     * @dev Reverts if ethereum value isn't equal to entrance multiplied by tickets amount
     * @dev and doesn't allow to enter if casino state isn't open.
     * @dev Pushing player address to casino players array as many times as tickets bought.
     * @dev Emits an event.
     * @param ticketsAmount number of tickets player wants to buy.
     */
    function enter(uint256 ticketsAmount) public payable {
        if (msg.value != i_entranceFee * ticketsAmount) {
            revert CasinoV1__PayEnoughEthereum();
        }
        if (s_casinoState != CasinoStates.OPEN) {
            revert CasinoV1__NotOpen();
        }
        for (uint256 ticket = 0; ticket < ticketsAmount; ticket++) {
            s_casinoPlayers.push(payable(msg.sender));
        }
        emit Entered(msg.sender, ticketsAmount);
    }

    /**
     * @notice This is the function that the Chainlink Keeper nodes call.
     * @notice they look for `upkeepNeeded` to return True.
     * @dev the following should be true for this to return true:
     * @dev 1. The casino is open,
     * @dev 2. The casino has players,
     * @dev 3. The contract has ETH,
     * @dev 4. The time interval has passed between casino runs.
     * @return upkeepNeeded variable.
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        bool isOpen = (s_casinoState == CasinoStates.OPEN);
        bool hasPlayers = (s_casinoPlayers.length > 0);
        bool hasBalance = (address(this).balance > 0);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        upkeepNeeded = (isOpen && hasPlayers && hasBalance && timePassed);
        return (upkeepNeeded, "0x0");
    }

    /**
     * @notice Once `checkUpkeep` is returning `true`, this function is called.
     * @notice It funds VRF subscription ID with some LINK if needed and requests random number.
     * @dev Changes casino state to the processing.
     * @dev If subscription ID is greater than 1 funds it with some LINK.
     * @dev Kicks off a Chainlink VRF call to get a random winner.
     * @dev Emits an event.
     */
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert CasinoV1__UpkeepIsFalse(
                address(this).balance,
                s_casinoPlayers.length,
                uint256(s_casinoState)
            );
        }
        s_casinoState = CasinoStates.PROCESSING;
        if (i_subId > 1) {
            (uint256 subBalance, , , ) = getSubscription();
            if (
                subBalance < i_vrfSubFundAmount &&
                i_linkToken.balanceOf(address(this)) >= i_vrfSubFundAmount
            ) {
                i_linkToken.transferAndCall(
                    address(i_vrfCoordinator),
                    i_vrfSubFundAmount,
                    abi.encode(i_subId)
                );
            }
        }
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subId,
            MIN_REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RandomRequested(requestId);
    }

    /**
     * @notice Automatically called if random number was requested.
     * @dev Calculates index of winner by modulo operator, sets winner as a global variable.
     * @dev Drops state variables, calculates owner commission as a 5%.
     * @dev Sends transaction to the winner: (contract balance - owner commission) --> winner address.
     * @dev Send transaction to the owner: owner commission --> owner address.
     * @dev Emits an event.
     * @param randomWords truly random numbers array that were requested from the Chainlink.
     */
    function fulfillRandomWords(
        uint256, /* requestId */
        uint256[] memory randomWords
    ) internal override {
        uint256 winnerIndex = randomWords[0] % s_casinoPlayers.length;
        address payable winner = s_casinoPlayers[winnerIndex];
        s_winner = winner;
        s_casinoState = CasinoStates.OPEN;
        s_casinoPlayers = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        uint256 ownerCommission = (address(this).balance * 500) / 10000;
        uint256 winnerReward = address(this).balance - ownerCommission;
        // tx to the winner
        (bool winnerTx, ) = winner.call{value: winnerReward}("");
        if (!winnerTx) {
            revert CasinoV1__TransferFailed();
        }
        // tx to the owner
        (bool ownerTX, ) = i_owner.call{value: ownerCommission}("");
        if (!ownerTX) {
            revert CasinoV1__TransferFailed();
        }
        emit WinnerPicked(winner, winnerReward);
    }

    /**
     * @notice Function that returns info about VRF subscription id.
     * @return balance - current LINK balance of the VRF subscription.
     * @return reqCount - requests amount.
     * @return owner - VRF subscription admin address.
     * @return consumers - list of VRF subscription consumers.
     */
    function getSubscription()
        public
        view
        returns (
            uint96 balance,
            uint64 reqCount,
            address owner,
            address[] memory consumers
        )
    {
        (balance, reqCount, owner, consumers) = i_vrfCoordinator.getSubscription(i_subId);
    }

    /* Get functions */
    function getCasinoState() public view returns (CasinoStates) {
        return s_casinoState;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getNumberOfTickets() public view returns (uint256) {
        return s_casinoPlayers.length;
    }

    function getPlayerByTicket(uint256 ticketNumber) public view returns (address) {
        return s_casinoPlayers[ticketNumber];
    }

    function getTicketsAmountByAddress(address player) public view returns (uint256 tickets) {
        for (uint256 i = 0; i < s_casinoPlayers.length; i++) {
            if (s_casinoPlayers[i] == player) {
                tickets += 1;
            }
        }
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRecentWinner() public view returns (address) {
        return s_winner;
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
