import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Comptroller,
  MarketListed
} from "../generated/Comptroller/Comptroller"
import { Token } from "../generated/schema"
import { CToken } from "../generated/templates";
import {
  fetchTokenSymbol,
  fetchTokenName,
  fetchTokenDecimals,
  fetchUnderlyingToken,
  ADDRESS_ZERO,
  ONE_BI,
  ZERO_BD,
  BI_18,
  WETHER
} from './helper'

export function handleMarketListed(event: MarketListed): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let ctoken = Token.load(event.params.cToken.toHex())
  if (!ctoken) {
    ctoken = new Token(event.params.cToken.toHex())
  }

  ctoken.name = fetchTokenName(event.params.cToken)
  ctoken.symbol = fetchTokenSymbol(event.params.cToken)
  let decimals = fetchTokenDecimals(event.params.cToken)
  if (decimals === null) {
    decimals = BigInt.fromI32(18)
  }
  ctoken.decimals = decimals
  let underlying = fetchUnderlyingToken(event.params.cToken)
  ctoken.underlying = underlying

  // Entities can be written to the store with `.save()`
  ctoken.save()

  if (underlying.toHex() === ADDRESS_ZERO) return

  let token = Token.load(underlying.toHex())
  if (!token) {
    token = new Token(underlying.toHex())
  }

  if (underlying.toHex() === WETHER) {
    token.name = "Wrapper ELA"
    token.symbol = "WELA"
    token.decimals = BigInt.fromI32(18)
  } else {
    token.name = fetchTokenName(underlying)
    token.symbol = fetchTokenSymbol(underlying)
    decimals = fetchTokenDecimals(underlying)
    if (decimals === null) {
      decimals = BigInt.fromI32(18)
    }
    token.decimals = decimals
  }

  token.underlying = Address.fromString(ADDRESS_ZERO)
  token.save()

  CToken.create(event.params.cToken)
}
