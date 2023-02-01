/* eslint-disable prefer-const */
import { log, BigInt, BigDecimal, Address, ethereum } from '@graphprotocol/graph-ts'
import { ERC20 } from '../generated/Comptroller/ERC20'
import { CErc20 } from '../generated/Comptroller/CErc20'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export const CETHER_ADDRESS = '0xF31AD464E61118c735E6d3C909e7a42DAA1575A3'
export const WETHER = '0x517E9e5d46C1EA8aB6f78677d6114Ef47F71f6c4'

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString('1000000000000000000')
}

export function convertEthToDecimal(eth: BigInt): BigDecimal {
  return eth.toBigDecimal().div(exponentToBigDecimal(18))
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);

  let symbolValue = "unknown";
  let symbolResult = contract.try_symbol();
  if (!symbolResult.reverted) {
    symbolValue = symbolResult.value;
  }
  return symbolValue;
}

export function fetchTokenName(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);

  let nameValue = "unknown";
  let nameResult = contract.try_name();
  if (!nameResult.reverted) {
    nameValue = nameResult.value;
  }
  return nameValue;
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  let decimalValue = null;
  let decimalResult = contract.try_decimals();
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value;
  }
  return BigInt.fromI32(decimalValue as i32);
}

export function fetchUnderlyingToken(tokenAddress: Address): Address {
  if (tokenAddress.toHex() === CETHER_ADDRESS) {
    return Address.fromString("");
  }
  let contract = CErc20.bind(tokenAddress);
  let underlying = ADDRESS_ZERO;
  let underlyingResult = contract.try_underlying();
  if (!underlyingResult.reverted) {
    underlying = underlyingResult.value.toHex();
  }
  return Address.fromString(underlying);
}
