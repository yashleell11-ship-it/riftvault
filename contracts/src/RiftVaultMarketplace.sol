// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RiftVaultMarketplace is ReentrancyGuard {
    uint256 public constant FEE_BPS = 250;
    address public feeRecipient;

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 priceWei;
        bool active;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 priceWei
    );
    event Sold(uint256 indexed listingId, address indexed buyer, uint256 priceWei);
    event Cancelled(uint256 indexed listingId);

    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "fee recipient required");
        feeRecipient = _feeRecipient;
    }

    function list(
        address nftContract,
        uint256 tokenId,
        uint256 priceWei
    ) external returns (uint256 listingId) {
        require(priceWei > 0, "price required");
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            priceWei: priceWei,
            active: true
        });

        emit Listed(listingId, msg.sender, nftContract, tokenId, priceWei);
    }

    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage item = listings[listingId];
        require(item.active, "not active");
        require(msg.value >= item.priceWei, "insufficient payment");

        item.active = false;

        uint256 fee = (item.priceWei * FEE_BPS) / 10000;
        uint256 sellerAmount = item.priceWei - fee;

        payable(item.seller).transfer(sellerAmount);
        payable(feeRecipient).transfer(fee);

        IERC721(item.nftContract).transferFrom(
            address(this),
            msg.sender,
            item.tokenId
        );

        uint256 refund = msg.value - item.priceWei;
        if (refund > 0) {
            payable(msg.sender).transfer(refund);
        }

        emit Sold(listingId, msg.sender, item.priceWei);
    }

    function cancel(uint256 listingId) external {
        Listing storage item = listings[listingId];
        require(item.active, "not active");
        require(item.seller == msg.sender, "not seller");

        item.active = false;
        IERC721(item.nftContract).transferFrom(
            address(this),
            item.seller,
            item.tokenId
        );

        emit Cancelled(listingId);
    }
}
