import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero, MaxUint256 } from 'ethers/constants'
import { bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { v2Fixture } from './shared/fixtures'
import { expandTo18Decimals, MINIMUM_LIQUIDITY } from './shared/utilities'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('DThorswapV2Migrator', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet])

  let WVETPartner: Contract
  let WVETPair: Contract
  let router: Contract
  let migrator: Contract
  let WVETExchangeV1: Contract
  beforeEach(async function() {
    const fixture = await loadFixture(v2Fixture)
    WVETPartner = fixture.WVETPartner
    WVETPair = fixture.WVETPair
    router = fixture.router01 // we used router01 for this contract
    migrator = fixture.migrator
    WVETExchangeV1 = fixture.WVETExchangeV1
  })

  it('migrate', async () => {
    const WVETPartnerAmount = expandTo18Decimals(1)
    const VETAmount = expandTo18Decimals(4)
    await WVETPartner.approve(WVETExchangeV1.address, MaxUint256)
    await WVETExchangeV1.addLiquidity(bigNumberify(1), WVETPartnerAmount, MaxUint256, {
      ...overrides,
      value: VETAmount
    })
    await WVETExchangeV1.approve(migrator.address, MaxUint256)
    const expectedLiquidity = expandTo18Decimals(2)
    const WVETPairToken0 = await WVETPair.token0()
    await expect(
      migrator.migrate(WVETPartner.address, WVETPartnerAmount, VETAmount, wallet.address, MaxUint256, overrides)
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
})
