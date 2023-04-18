import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import DThorswapV2Factory from '../../../v2-core/build/DThorswapV2Factory.json'
import IDThorswapV2Pair from '../../../v2-core/build/IDThorswapV2Pair.json'

import ERC20 from '../../build/ERC20.json'
import WVET9 from '../../build/WVET9.json'
import DThorswapV1Exchange from '../../build/DThorswapV1Exchange.json'
import DThorswapV1Factory from '../../build/DThorswapV1Factory.json'
import DThorswapV2Router01 from '../../build/DThorswapV2Router01.json'
import DThorswapV2Migrator from '../../build/DThorswapV2Migrator.json'
import DThorswapV2Router02 from '../../build/DThorswapV2Router02.json'
import RouterEventEmitter from '../../build/RouterEventEmitter.json'

const overrides = {
  gasLimit: 9999999
}

interface V2Fixture {
  token0: Contract
  token1: Contract
  WVET: Contract
  WVETPartner: Contract
  factoryV1: Contract
  factoryV2: Contract
  router01: Contract
  router02: Contract
  routerEventEmitter: Contract
  router: Contract
  migrator: Contract
  WVETExchangeV1: Contract
  pair: Contract
  WVETPair: Contract
}

export async function v2Fixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<V2Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const WVET = await deployContract(wallet, WVET9)
  const WVETPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])

  // deploy V1
  const factoryV1 = await deployContract(wallet, DThorswapV1Factory, [])
  await factoryV1.initializeFactory((await deployContract(wallet, DThorswapV1Exchange, [])).address)

  // deploy V2
  const defaultSwapFee = 30    // Align swapFee with uniswap-v2 original fee
  const defaultPlatformFee = 0 // set platform to zero, equivalent to fee-off in uniswap-v2.
  const platformFeeTo = '0x3000000000000000000000000000000000000000'
  const factoryV2 = await deployContract(wallet, DThorswapV2Factory, [defaultSwapFee, defaultPlatformFee, platformFeeTo, wallet.address], overrides)

  // deploy routers
  const router01 = await deployContract(wallet, DThorswapV2Router01, [factoryV2.address, WVET.address], overrides)
  const router02 = await deployContract(wallet, DThorswapV2Router02, [factoryV2.address, WVET.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // deploy migrator
  const migrator = await deployContract(wallet, DThorswapV2Migrator, [factoryV1.address, router01.address], overrides)

  // initialize V1
  await factoryV1.createExchange(WVETPartner.address, overrides)
  const WVETExchangeV1Address = await factoryV1.getExchange(WVETPartner.address)
  const WVETExchangeV1 = new Contract(WVETExchangeV1Address, JSON.stringify(DThorswapV1Exchange.abi), provider).connect(
    wallet
  )

  // initialize V2
  await factoryV2.createPair(tokenA.address, tokenB.address)
  const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(IDThorswapV2Pair.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await factoryV2.createPair(WVET.address, WVETPartner.address)
  const WVETPairAddress = await factoryV2.getPair(WVET.address, WVETPartner.address)
  const WVETPair = new Contract(WVETPairAddress, JSON.stringify(IDThorswapV2Pair.abi), provider).connect(wallet)

  return {
    token0,
    token1,
    WVET,
    WVETPartner,
    factoryV1,
    factoryV2,
    router01,
    router02,
    router: router02, // the default router, 01 had a minor bug
    routerEventEmitter,
    migrator,
    WVETExchangeV1,
    pair,
    WVETPair
  }
}
