pragma solidity >=0.5.0;

interface IDThorswapV2Factory {
    // event PairCreated(address indexed token0, address indexed token1, address pair, uint); // Uniswap
    event PairCreated(address indexed token0, address indexed token1, address pair, uint totalPair, uint swapFee, uint platformFee);
    event PlatformFeeToChanged(address oldFeeTo, address newFeeTo);
    event DefaultSwapFeeChanged(uint oldDefaultSwapFee, uint newDefaultSwapFee);
    event DefaultPlatformFeeChanged(uint oldDefaultPlatformFee, uint newDefaultPlatformFee);
    event DefaultRecovererChanged(address oldDefaultRecoverer, address newDefaultRecoverer);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    // Ownable
    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;

    // DThor (Fee)
    function MAX_PLATFORM_FEE() external view returns (uint);
    function MIN_SWAP_FEE() external view returns (uint);
    function MAX_SWAP_FEE() external view returns (uint);

    function platformFeeTo() external view returns (address);
    function setPlatformFeeTo(address) external;

    function defaultSwapFee() external view returns (uint);
    function defaultPlatformFee() external view returns (uint);
    function defaultRecoverer() external view returns (address);
    // function defaultPlatformFeeOn() external view returns (bool);

    function setDefaultSwapFee(uint) external;
    function setDefaultPlatformFee(uint) external;
    function setDefaultRecoverer(address) external;

    function setSwapFeeForPair(address, uint) external;
    function setPlatformFeeForPair(address, uint) external;
}
