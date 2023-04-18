pragma solidity >=0.5.0;

interface IDThorswapV2Migrator {
    function migrate(address token, uint amountTokenMin, uint amountVETMin, address to, uint deadline) external;
}
