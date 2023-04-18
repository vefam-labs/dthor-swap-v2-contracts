import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero, Zero, MaxUint256 } from 'ethers/constants'
import { BigNumber, bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

import { expandTo18Decimals, getApprovalDigest, mineBlock, MINIMUM_LIQUIDITY, verifyGas } from './shared/utilities'
import { v2Fixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

enum RouterVersion {
  DThorswapV2Router01 = 'DThorswapV2Router01',
  DThorswapV2Router02 = 'DThorswapV2Router02'
}

describe('DThorswapV2Router{01,02}', () => {
  for (const routerVersion of Object.keys(RouterVersion)) {
    const provider = new MockProvider({
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    })
    const [wallet] = provider.getWallets()
    const loadFixture = createFixtureLoader(provider, [wallet])

    let token0: Contract
    let token1: Contract
    let WVET: Contract
    let WVETPartner: Contract
    let factory: Contract
    let router: Contract
    let pair: Contract
    let WVETPair: Contract
    let routerEventEmitter: Contract
    beforeEach(async function() {
      const fixture = await loadFixture(v2Fixture)
      token0 = fixture.token0
      token1 = fixture.token1
      WVET = fixture.WVET
      WVETPartner = fixture.WVETPartner
      factory = fixture.factoryV2
      router = {
        [RouterVersion.DThorswapV2Router01]: fixture.router01,
        [RouterVersion.DThorswapV2Router02]: fixture.router02
      }[routerVersion as RouterVersion]
      pair = fixture.pair
      WVETPair = fixture.WVETPair
      routerEventEmitter = fixture.routerEventEmitter
    })

    afterEach(async function() {
      expect(await provider.getBalance(router.address)).to.eq(Zero)
    })

    describe(routerVersion, () => {
      it('factory, WVET', async () => {
        expect(await router.factory()).to.eq(factory.address)
        expect(await router.WVET()).to.eq(WVET.address)
      })

      it('addLiquidity', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)
        await token0.approve(router.address, MaxUint256)
        await token1.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidity(
            token0.address,
            token1.address,
            token0Amount,
            token1Amount,
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(token0, 'Transfer')
          .withArgs(wallet.address, pair.address, token0Amount)
          .to.emit(token1, 'Transfer')
          .withArgs(wallet.address, pair.address, token1Amount)
          .to.emit(pair, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pair, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pair, 'Sync')
          .withArgs(token0Amount, token1Amount)
          .to.emit(pair, 'Mint')
          .withArgs(router.address, token0Amount, token1Amount)

        expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      })

      it('addLiquidityVET', async () => {
        const WVETPartnerAmount = expandTo18Decimals(1)
        const VETAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)
        const WVETPairToken0 = await WVETPair.token0()
        await WVETPartner.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidityVET(
            WVETPartner.address,
            WVETPartnerAmount,
            WVETPartnerAmount,
            VETAmount,
            wallet.address,
            MaxUint256,
            { ...overrides, value: VETAmount }
          )
        )
          .to.emit(WVETPair, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WVETPair, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WVETPair, 'Sync')
          .withArgs(
            WVETPairToken0 === WVETPartner.address ? WVETPartnerAmount : VETAmount,
            WVETPairToken0 === WVETPartner.address ? VETAmount : WVETPartnerAmount
          )
          .to.emit(WVETPair, 'Mint')
          .withArgs(
            router.address,
            WVETPairToken0 === WVETPartner.address ? WVETPartnerAmount : VETAmount,
            WVETPairToken0 === WVETPartner.address ? VETAmount : WVETPartnerAmount
          )

        expect(await WVETPair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      })

      async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
        await token0.transfer(pair.address, token0Amount)
        await token1.transfer(pair.address, token1Amount)
        await pair.mint(wallet.address, overrides)
      }
      it('removeLiquidity', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)
        await addLiquidity(token0Amount, token1Amount)

        const expectedLiquidity = expandTo18Decimals(2)
        await pair.approve(router.address, MaxUint256)
        await expect(
          router.removeLiquidity(
            token0.address,
            token1.address,
            expectedLiquidity.sub(MINIMUM_LIQUIDITY),
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(pair, 'Transfer')
          .withArgs(wallet.address, pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pair, 'Transfer')
          .withArgs(pair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(token0, 'Transfer')
          .withArgs(pair.address, wallet.address, token0Amount.sub(500))
          .to.emit(token1, 'Transfer')
          .withArgs(pair.address, wallet.address, token1Amount.sub(2000))
          .to.emit(pair, 'Sync')
          .withArgs(500, 2000)
          .to.emit(pair, 'Burn')
          .withArgs(router.address, token0Amount.sub(500), token1Amount.sub(2000), wallet.address)

        expect(await pair.balanceOf(wallet.address)).to.eq(0)
        const totalSupplyToken0 = await token0.totalSupply()
        const totalSupplyToken1 = await token1.totalSupply()
        expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(500))
        expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(2000))
      })

      it('removeLiquidityVET', async () => {
        const WVETPartnerAmount = expandTo18Decimals(1)
        const VETAmount = expandTo18Decimals(4)
        await WVETPartner.transfer(WVETPair.address, WVETPartnerAmount)
        await WVET.deposit({ value: VETAmount })
        await WVET.transfer(WVETPair.address, VETAmount)
        await WVETPair.mint(wallet.address, overrides)

        const expectedLiquidity = expandTo18Decimals(2)
        const WVETPairToken0 = await WVETPair.token0()
        await WVETPair.approve(router.address, MaxUint256)
        await expect(
          router.removeLiquidityVET(
            WVETPartner.address,
            expectedLiquidity.sub(MINIMUM_LIQUIDITY),
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(WVETPair, 'Transfer')
          .withArgs(wallet.address, WVETPair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WVETPair, 'Transfer')
          .withArgs(WVETPair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WVET, 'Transfer')
          .withArgs(WVETPair.address, router.address, VETAmount.sub(2000))
          .to.emit(WVETPartner, 'Transfer')
          .withArgs(WVETPair.address, router.address, WVETPartnerAmount.sub(500))
          .to.emit(WVETPartner, 'Transfer')
          .withArgs(router.address, wallet.address, WVETPartnerAmount.sub(500))
          .to.emit(WVETPair, 'Sync')
          .withArgs(
            WVETPairToken0 === WVETPartner.address ? 500 : 2000,
            WVETPairToken0 === WVETPartner.address ? 2000 : 500
          )
          .to.emit(WVETPair, 'Burn')
          .withArgs(
            router.address,
            WVETPairToken0 === WVETPartner.address ? WVETPartnerAmount.sub(500) : VETAmount.sub(2000),
            WVETPairToken0 === WVETPartner.address ? VETAmount.sub(2000) : WVETPartnerAmount.sub(500),
            router.address
          )

        expect(await WVETPair.balanceOf(wallet.address)).to.eq(0)
        const totalSupplyWVETPartner = await WVETPartner.totalSupply()
        const totalSupplyWVET = await WVET.totalSupply()
        expect(await WVETPartner.balanceOf(wallet.address)).to.eq(totalSupplyWVETPartner.sub(500))
        expect(await WVET.balanceOf(wallet.address)).to.eq(totalSupplyWVET.sub(2000))
      })

      it('removeLiquidityWithPermit', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)
        await addLiquidity(token0Amount, token1Amount)

        const expectedLiquidity = expandTo18Decimals(2)

        const nonce = await pair.nonces(wallet.address)
        const digest = await getApprovalDigest(
          pair,
          { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
          nonce,
          MaxUint256,
          1
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        await router.removeLiquidityWithPermit(
          token0.address,
          token1.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY),
          0,
          0,
          wallet.address,
          MaxUint256,
          false,
          v,
          r,
          s,
          overrides
        )
      })

      it('removeLiquidityVETWithPermit', async () => {
        const WVETPartnerAmount = expandTo18Decimals(1)
        const VETAmount = expandTo18Decimals(4)
        await WVETPartner.transfer(WVETPair.address, WVETPartnerAmount)
        await WVET.deposit({ value: VETAmount })
        await WVET.transfer(WVETPair.address, VETAmount)
        await WVETPair.mint(wallet.address, overrides)

        const expectedLiquidity = expandTo18Decimals(2)

        const nonce = await WVETPair.nonces(wallet.address)
        const digest = await getApprovalDigest(
          WVETPair,
          { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
          nonce,
          MaxUint256,
          1
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        await router.removeLiquidityVETWithPermit(
          WVETPartner.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY),
          0,
          0,
          wallet.address,
          MaxUint256,
          false,
          v,
          r,
          s,
          overrides
        )
      })

      describe('swapExactTokensForTokens', () => {
        const token0Amount = expandTo18Decimals(5)
        const token1Amount = expandTo18Decimals(10)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1662497915624478906')

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount)
          await token0.approve(router.address, MaxUint256)
        })

        it('happy path', async () => {
          await expect(
            router.swapExactTokensForTokens(
              swapAmount,
              0,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, pair.address, swapAmount)
            .to.emit(token1, 'Transfer')
            .withArgs(pair.address, wallet.address, expectedOutputAmount)
            .to.emit(pair, 'Sync')
            .withArgs(token0Amount.add(swapAmount), token1Amount.sub(expectedOutputAmount))
            .to.emit(pair, 'Swap')
            .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
        })

        it('amounts', async () => {
          await token0.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapExactTokensForTokens(
              router.address,
              swapAmount,
              0,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })

        it('gas', async () => {
          // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          await pair.sync(overrides)

          await token0.approve(router.address, MaxUint256)
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          const tx = await router.swapExactTokensForTokens(
            swapAmount,
            0,
            [token0.address, token1.address],
            wallet.address,
            MaxUint256,
            overrides
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(
            {
              [RouterVersion.DThorswapV2Router01]: 106964, // 101876
              [RouterVersion.DThorswapV2Router02]: 106986 // 101898
            }[routerVersion as RouterVersion]
          )
        }).retries(3)
      })

      describe('swapTokensForExactTokens', () => {
        const token0Amount = expandTo18Decimals(5)
        const token1Amount = expandTo18Decimals(10)
        const expectedSwapAmount = bigNumberify('557227237267357629')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount)
        })

        it('happy path', async () => {
          await token0.approve(router.address, MaxUint256)
          await expect(
            router.swapTokensForExactTokens(
              outputAmount,
              MaxUint256,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, pair.address, expectedSwapAmount)
            .to.emit(token1, 'Transfer')
            .withArgs(pair.address, wallet.address, outputAmount)
            .to.emit(pair, 'Sync')
            .withArgs(token0Amount.add(expectedSwapAmount), token1Amount.sub(outputAmount))
            .to.emit(pair, 'Swap')
            .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, wallet.address)
        })

        it('amounts', async () => {
          await token0.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapTokensForExactTokens(
              router.address,
              outputAmount,
              MaxUint256,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })

      describe('swapExactVETForTokens', () => {
        const WVETPartnerAmount = expandTo18Decimals(10)
        const VETAmount = expandTo18Decimals(5)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1662497915624478906')

        beforeEach(async () => {
          await WVETPartner.transfer(WVETPair.address, WVETPartnerAmount)
          await WVET.deposit({ value: VETAmount })
          await WVET.transfer(WVETPair.address, VETAmount)
          await WVETPair.mint(wallet.address, overrides)

          await token0.approve(router.address, MaxUint256)
        })

        it('happy path', async () => {
          const WVETPairToken0 = await WVETPair.token0()
          await expect(
            router.swapExactVETForTokens(0, [WVET.address, WVETPartner.address], wallet.address, MaxUint256, {
              ...overrides,
              value: swapAmount
            })
          )
            .to.emit(WVET, 'Transfer')
            .withArgs(router.address, WVETPair.address, swapAmount)
            .to.emit(WVETPartner, 'Transfer')
            .withArgs(WVETPair.address, wallet.address, expectedOutputAmount)
            .to.emit(WVETPair, 'Sync')
            .withArgs(
              WVETPairToken0 === WVETPartner.address
                ? WVETPartnerAmount.sub(expectedOutputAmount)
                : VETAmount.add(swapAmount),
              WVETPairToken0 === WVETPartner.address
                ? VETAmount.add(swapAmount)
                : WVETPartnerAmount.sub(expectedOutputAmount)
            )
            .to.emit(WVETPair, 'Swap')
            .withArgs(
              router.address,
              WVETPairToken0 === WVETPartner.address ? 0 : swapAmount,
              WVETPairToken0 === WVETPartner.address ? swapAmount : 0,
              WVETPairToken0 === WVETPartner.address ? expectedOutputAmount : 0,
              WVETPairToken0 === WVETPartner.address ? 0 : expectedOutputAmount,
              wallet.address
            )
        })

        it('amounts', async () => {
          await expect(
            routerEventEmitter.swapExactVETForTokens(
              router.address,
              0,
              [WVET.address, WVETPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: swapAmount
              }
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })

        it('gas', async () => {
          const WVETPartnerAmount = expandTo18Decimals(10)
          const VETAmount = expandTo18Decimals(5)
          await WVETPartner.transfer(WVETPair.address, WVETPartnerAmount)
          await WVET.deposit({ value: VETAmount })
          await WVET.transfer(WVETPair.address, VETAmount)
          await WVETPair.mint(wallet.address, overrides)

          // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          await pair.sync(overrides)

          const swapAmount = expandTo18Decimals(1)
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          const tx = await router.swapExactVETForTokens(
            0,
            [WVET.address, WVETPartner.address],
            wallet.address,
            MaxUint256,
            {
              ...overrides,
              value: swapAmount
            }
          )
          const receipt = await tx.wait()
          /*
          expect(receipt.gasUsed).to.eq(
            {
              [RouterVersion.DThorswapV2Router01]: 138770,
              [RouterVersion.DThorswapV2Router02]: 138770
            }[routerVersion as RouterVersion]
          )
        }).retries(3) */
          expect(receipt.gasUsed).to.satisfy( function(gas: number) {
            if (routerVersion == RouterVersion.DThorswapV2Router01) {
              return verifyGas(gas, [113847, 113869, 113826, 143826], "swapExactVETForTokens Router01");
            }
            else if (routerVersion == RouterVersion.DThorswapV2Router02) {
              return verifyGas(gas, [113849, 113869, 143849, 113870], "swapExactVETForTokens Router02");
            }
          })
        })
      })

      describe('swapTokensForExactVET', () => {
        const WVETPartnerAmount = expandTo18Decimals(5)
        const VETAmount = expandTo18Decimals(10)
        const expectedSwapAmount = bigNumberify('557227237267357629')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await WVETPartner.transfer(WVETPair.address, WVETPartnerAmount)
          await WVET.deposit({ value: VETAmount })
          await WVET.transfer(WVETPair.address, VETAmount)
          await WVETPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await WVETPartner.approve(router.address, MaxUint256)
          const WVETPairToken0 = await WVETPair.token0()
          await expect(
            router.swapTokensForExactVET(
              outputAmount,
              MaxUint256,
              [WVETPartner.address, WVET.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(WVETPartner, 'Transfer')
            .withArgs(wallet.address, WVETPair.address, expectedSwapAmount)
            .to.emit(WVET, 'Transfer')
            .withArgs(WVETPair.address, router.address, outputAmount)
            .to.emit(WVETPair, 'Sync')
            .withArgs(
              WVETPairToken0 === WVETPartner.address
                ? WVETPartnerAmount.add(expectedSwapAmount)
                : VETAmount.sub(outputAmount),
              WVETPairToken0 === WVETPartner.address
                ? VETAmount.sub(outputAmount)
                : WVETPartnerAmount.add(expectedSwapAmount)
            )
            .to.emit(WVETPair, 'Swap')
            .withArgs(
              router.address,
              WVETPairToken0 === WVETPartner.address ? expectedSwapAmount : 0,
              WVETPairToken0 === WVETPartner.address ? 0 : expectedSwapAmount,
              WVETPairToken0 === WVETPartner.address ? 0 : outputAmount,
              WVETPairToken0 === WVETPartner.address ? outputAmount : 0,
              router.address
            )
        })

        it('amounts', async () => {
          await WVETPartner.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapTokensForExactVET(
              router.address,
              outputAmount,
              MaxUint256,
              [WVETPartner.address, WVET.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })

      describe('swapExactTokensForVET', () => {
        const WVETPartnerAmount = expandTo18Decimals(5)
        const VETAmount = expandTo18Decimals(10)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1662497915624478906')

        beforeEach(async () => {
          await WVETPartner.transfer(WVETPair.address, WVETPartnerAmount)
          await WVET.deposit({ value: VETAmount })
          await WVET.transfer(WVETPair.address, VETAmount)
          await WVETPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await WVETPartner.approve(router.address, MaxUint256)
          const WVETPairToken0 = await WVETPair.token0()
          await expect(
            router.swapExactTokensForVET(
              swapAmount,
              0,
              [WVETPartner.address, WVET.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(WVETPartner, 'Transfer')
            .withArgs(wallet.address, WVETPair.address, swapAmount)
            .to.emit(WVET, 'Transfer')
            .withArgs(WVETPair.address, router.address, expectedOutputAmount)
            .to.emit(WVETPair, 'Sync')
            .withArgs(
              WVETPairToken0 === WVETPartner.address
                ? WVETPartnerAmount.add(swapAmount)
                : VETAmount.sub(expectedOutputAmount),
              WVETPairToken0 === WVETPartner.address
                ? VETAmount.sub(expectedOutputAmount)
                : WVETPartnerAmount.add(swapAmount)
            )
            .to.emit(WVETPair, 'Swap')
            .withArgs(
              router.address,
              WVETPairToken0 === WVETPartner.address ? swapAmount : 0,
              WVETPairToken0 === WVETPartner.address ? 0 : swapAmount,
              WVETPairToken0 === WVETPartner.address ? 0 : expectedOutputAmount,
              WVETPairToken0 === WVETPartner.address ? expectedOutputAmount : 0,
              router.address
            )
        })

        it('amounts', async () => {
          await WVETPartner.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapExactTokensForVET(
              router.address,
              swapAmount,
              0,
              [WVETPartner.address, WVET.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })
      })

      describe('swapVETForExactTokens', () => {
        const WVETPartnerAmount = expandTo18Decimals(10)
        const VETAmount = expandTo18Decimals(5)
        const expectedSwapAmount = bigNumberify('557227237267357629')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await WVETPartner.transfer(WVETPair.address, WVETPartnerAmount)
          await WVET.deposit({ value: VETAmount })
          await WVET.transfer(WVETPair.address, VETAmount)
          await WVETPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          const WVETPairToken0 = await WVETPair.token0()
          await expect(
            router.swapVETForExactTokens(
              outputAmount,
              [WVET.address, WVETPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
            )
          )
            .to.emit(WVET, 'Transfer')
            .withArgs(router.address, WVETPair.address, expectedSwapAmount)
            .to.emit(WVETPartner, 'Transfer')
            .withArgs(WVETPair.address, wallet.address, outputAmount)
            .to.emit(WVETPair, 'Sync')
            .withArgs(
              WVETPairToken0 === WVETPartner.address
                ? WVETPartnerAmount.sub(outputAmount)
                : VETAmount.add(expectedSwapAmount),
              WVETPairToken0 === WVETPartner.address
                ? VETAmount.add(expectedSwapAmount)
                : WVETPartnerAmount.sub(outputAmount)
            )
            .to.emit(WVETPair, 'Swap')
            .withArgs(
              router.address,
              WVETPairToken0 === WVETPartner.address ? 0 : expectedSwapAmount,
              WVETPairToken0 === WVETPartner.address ? expectedSwapAmount : 0,
              WVETPairToken0 === WVETPartner.address ? outputAmount : 0,
              WVETPairToken0 === WVETPartner.address ? 0 : outputAmount,
              wallet.address
            )
        })

        it('amounts', async () => {
          await expect(
            routerEventEmitter.swapVETForExactTokens(
              router.address,
              outputAmount,
              [WVET.address, WVETPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })
    })
  }
})
