# DThorSwap (Uniswap V2 Fork)

## Credits
This is a fork of several repositories from https://github.com/Uniswap/

All tests passed.

# For Developers
```bash
/v2-core        # core contracts for assets
/v2-periphery   # surrounding contract for user interface
```

```bash
npm install # install dependencies.
npm run compile # Compile all contracts.
npm run test # Run all the tests.
```

## Addresses

**Mainnet**
| Contract      | Address                                    |
| ---           | ---                                        |
| WVET          | 0xb9Dfd9eAEeEdAbeB3ad41F6a88474D4a43A2307D |
| V2Factory     | 0xe22cbBA738159F5851d139d682D79F3B1082BD52 |
| V2Router01    | 0xc5d347515bB834f116252d9fb062f99d2d36E750 |

**Testnet**
| Contract      | Address                                    |
| ---           | ---                                        |
| WVET          | 0x47a7A149E22f1556de85F9144332dE45b371Be5F |
| V2Factory     | 0x8150e744Ccf61c73A8e8084CEA778A2656cc9241 |
| V2Router01    | 0xDEF9964c68Be77f54b7416AD3b302E9cAd3Ad87E |

# Branches in this repo:

## `main` branch

What is changed:
- Change the word in the name and variable of the contract: `Uniswap -> DThorswap`, `uniswap -> dthorswap`, `WETH -> WVET`, `ETH -> VET`, `weth -> wvet`, `eth -> vet`
- Change variable names of LP token `symbol` and `name`. (v2-core/contracts/DThorswapV2ERC20.sol)
- `CREATE2` hash. (v2-periphery/contracts/libraries/DThorswapV2Library.sol)
- Add swap fee change feature for DAO

What remains:
- `chainId()` call remains the same.
- Compiler option `istanbul` remains the same.

This is compatible with VeChain after update of thor code `1.5.1`

# Disclaimer
This repo keeps the upstream license of GPL-3.0.

Redistributions of source code must retain this list of conditions and the following disclaimer.

Neither the name of VeFam (VeFam Labs) nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.