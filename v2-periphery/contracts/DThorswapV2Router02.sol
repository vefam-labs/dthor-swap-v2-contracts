pragma solidity =0.6.6;

import './ext-v2-core/IDThorswapV2Factory.sol';
import './ext-lib/TransferHelper.sol';

import './interfaces/IDThorswapV2Router02.sol';
import './libraries/DThorswapV2Library.sol';
import './libraries/SafeMath.sol';
import './interfaces/IERC20.sol';
import './interfaces/IWVET.sol';

contract DThorswapV2Router02 is IDThorswapV2Router02 {
    using SafeMath for uint;

    address public immutable override factory;
    address public immutable override WVET;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'DThorswapV2Router: EXPIRED');
        _;
    }

    constructor(address _factory, address _WVET) public {
        factory = _factory;
        WVET = _WVET;
    }

    receive() external payable {
        assert(msg.sender == WVET); // only accept VET via fallback from the WVET contract
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal virtual returns (uint amountA, uint amountB) {
        // create the pair if it doesn't exist yet
        if (IDThorswapV2Factory(factory).getPair(tokenA, tokenB) == address(0)) {
            IDThorswapV2Factory(factory).createPair(tokenA, tokenB);
        }
        (uint reserveA, uint reserveB) = DThorswapV2Library.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = DThorswapV2Library.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'DThorswapV2Router: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = DThorswapV2Library.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'DThorswapV2Router: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = DThorswapV2Library.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IDThorswapV2Pair(pair).mint(to);
    }
    function addLiquidityVET(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountVETMin,
        address to,
        uint deadline
    ) external virtual override payable ensure(deadline) returns (uint amountToken, uint amountVET, uint liquidity) {
        (amountToken, amountVET) = _addLiquidity(
            token,
            WVET,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountVETMin
        );
        address pair = DThorswapV2Library.pairFor(factory, token, WVET);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWVET(WVET).deposit{value: amountVET}();
        assert(IWVET(WVET).transfer(pair, amountVET));
        liquidity = IDThorswapV2Pair(pair).mint(to);
        // refund dust vet, if any
        if (msg.value > amountVET) TransferHelper.safeTransferVET(msg.sender, msg.value - amountVET);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        address pair = DThorswapV2Library.pairFor(factory, tokenA, tokenB);
        IDThorswapV2Pair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        (uint amount0, uint amount1) = IDThorswapV2Pair(pair).burn(to);
        (address token0,) = DThorswapV2Library.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, 'DThorswapV2Router: INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'DThorswapV2Router: INSUFFICIENT_B_AMOUNT');
    }
    function removeLiquidityVET(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountVETMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountToken, uint amountVET) {
        (amountToken, amountVET) = removeLiquidity(
            token,
            WVET,
            liquidity,
            amountTokenMin,
            amountVETMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, amountToken);
        IWVET(WVET).withdraw(amountVET);
        TransferHelper.safeTransferVET(to, amountVET);
    }
    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountA, uint amountB) {
        address pair = DThorswapV2Library.pairFor(factory, tokenA, tokenB);
        uint value = approveMax ? uint(-1) : liquidity;
        IDThorswapV2Pair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountA, amountB) = removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);
    }
    function removeLiquidityVETWithPermit(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountVETMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountToken, uint amountVET) {
        address pair = DThorswapV2Library.pairFor(factory, token, WVET);
        uint value = approveMax ? uint(-1) : liquidity;
        IDThorswapV2Pair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountToken, amountVET) = removeLiquidityVET(token, liquidity, amountTokenMin, amountVETMin, to, deadline);
    }

    // **** REMOVE LIQUIDITY (supporting fee-on-transfer tokens) ****
    function removeLiquidityVETSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountVETMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountVET) {
        (, amountVET) = removeLiquidity(
            token,
            WVET,
            liquidity,
            amountTokenMin,
            amountVETMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, IERC20(token).balanceOf(address(this)));
        IWVET(WVET).withdraw(amountVET);
        TransferHelper.safeTransferVET(to, amountVET);
    }
    function removeLiquidityVETWithPermitSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountVETMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountVET) {
        address pair = DThorswapV2Library.pairFor(factory, token, WVET);
        uint value = approveMax ? uint(-1) : liquidity;
        IDThorswapV2Pair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        amountVET = removeLiquidityVETSupportingFeeOnTransferTokens(
            token, liquidity, amountTokenMin, amountVETMin, to, deadline
        );
    }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal virtual {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = DThorswapV2Library.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
            address to = i < path.length - 2 ? DThorswapV2Library.pairFor(factory, output, path[i + 2]) : _to;
            IDThorswapV2Pair(DThorswapV2Library.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        amounts = DThorswapV2Library.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'DThorswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, DThorswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        amounts = DThorswapV2Library.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'DThorswapV2Router: EXCESSIVE_INPUT_AMOUNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, DThorswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }
    function swapExactVETForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        payable
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WVET, 'DThorswapV2Router: INVALID_PATH');
        amounts = DThorswapV2Library.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'DThorswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
        IWVET(WVET).deposit{value: amounts[0]}();
        assert(IWVET(WVET).transfer(DThorswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }
    function swapTokensForExactVET(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WVET, 'DThorswapV2Router: INVALID_PATH');
        amounts = DThorswapV2Library.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'DThorswapV2Router: EXCESSIVE_INPUT_AMOUNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, DThorswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWVET(WVET).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferVET(to, amounts[amounts.length - 1]);
    }
    function swapExactTokensForVET(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WVET, 'DThorswapV2Router: INVALID_PATH');
        amounts = DThorswapV2Library.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'DThorswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, DThorswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWVET(WVET).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferVET(to, amounts[amounts.length - 1]);
    }
    function swapVETForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        payable
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WVET, 'DThorswapV2Router: INVALID_PATH');
        amounts = DThorswapV2Library.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= msg.value, 'DThorswapV2Router: EXCESSIVE_INPUT_AMOUNT');
        IWVET(WVET).deposit{value: amounts[0]}();
        assert(IWVET(WVET).transfer(DThorswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
        // refund dust vet, if any
        if (msg.value > amounts[0]) TransferHelper.safeTransferVET(msg.sender, msg.value - amounts[0]);
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(address[] memory path, address _to) internal virtual {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = DThorswapV2Library.sortTokens(input, output);
            IDThorswapV2Pair pair = IDThorswapV2Pair(DThorswapV2Library.pairFor(factory, input, output));
            uint amountInput;
            uint amountOutput;
            { // scope to avoid stack too deep errors
            (uint reserve0, uint reserve1,) = pair.getReserves();
            (uint reserveInput, uint reserveOutput) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
            amountInput = IERC20(input).balanceOf(address(pair)).sub(reserveInput);
            amountOutput = DThorswapV2Library.getAmountOut(amountInput, reserveInput, reserveOutput, pair.swapFee());
            }
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOutput) : (amountOutput, uint(0));
            address to = i < path.length - 2 ? DThorswapV2Library.pairFor(factory, output, path[i + 2]) : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) {
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, DThorswapV2Library.pairFor(factory, path[0], path[1]), amountIn
        );
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            'DThorswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT'
        );
    }
    function swapExactVETForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        virtual
        override
        payable
        ensure(deadline)
    {
        require(path[0] == WVET, 'DThorswapV2Router: INVALID_PATH');
        uint amountIn = msg.value;
        IWVET(WVET).deposit{value: amountIn}();
        assert(IWVET(WVET).transfer(DThorswapV2Library.pairFor(factory, path[0], path[1]), amountIn));
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            'DThorswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT'
        );
    }
    function swapExactTokensForVETSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        virtual
        override
        ensure(deadline)
    {
        require(path[path.length - 1] == WVET, 'DThorswapV2Router: INVALID_PATH');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, DThorswapV2Library.pairFor(factory, path[0], path[1]), amountIn
        );
        _swapSupportingFeeOnTransferTokens(path, address(this));
        uint amountOut = IERC20(WVET).balanceOf(address(this));
        require(amountOut >= amountOutMin, 'DThorswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
        IWVET(WVET).withdraw(amountOut);
        TransferHelper.safeTransferVET(to, amountOut);
    }

    // **** LIBRARY FUNCTIONS ****
    function quote(uint amountA, uint reserveA, uint reserveB) public pure virtual override returns (uint amountB) {
        return DThorswapV2Library.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut, uint swapFee)
        public
        pure
        virtual
        override
        returns (uint amountOut)
    {
        return DThorswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut, swapFee);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut, uint swapFee)
        public
        pure
        virtual
        override
        returns (uint amountIn)
    {
        return DThorswapV2Library.getAmountIn(amountOut, reserveIn, reserveOut, swapFee);
    }

    function getAmountsOut(uint amountIn, address[] memory path)
        public
        view
        virtual
        override
        returns (uint[] memory amounts)
    {
        return DThorswapV2Library.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint amountOut, address[] memory path)
        public
        view
        virtual
        override
        returns (uint[] memory amounts)
    {
        return DThorswapV2Library.getAmountsIn(factory, amountOut, path);
    }
}
