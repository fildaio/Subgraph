import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Comptroller,
  MarketListed,
  MarketEntered,
  MarketExited,
  DistributedBorrowerComp,
  DistributedSupplierComp
} from "../generated/Comptroller/Comptroller"
import { Token, MarketStatus } from "../generated/schema"
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

import {
  getUser,
  updateCompRewards
} from "./entities/user"

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

export function handleMarketEntered(event: MarketEntered): void {
  let user = getUser(event.params.account)

  let ctokenId = event.params.cToken.toHex()
  let ctoken = Token.load(ctokenId)
  // get ctoken failed,exit
  if (!ctoken) return

  let id = ctokenId.concat("_").concat(event.params.account.toHex())
  let status = MarketStatus.load(id)
  if (!status) {
    status = new MarketStatus(id)
    status.token = ctoken.id
    status.user = user.id
  }
  status.timestamp = event.block.timestamp
  status.entered = true
  status.save()
}

export function handleMarketExited(event: MarketExited): void {
  let user = getUser(event.params.account)

  let ctokenId = event.params.cToken.toHex()
  let ctoken = Token.load(ctokenId)
  // get ctoken failed,exit
  if (!ctoken) return

  let id = ctokenId.concat("_").concat(event.params.account.toHex())
  let status = MarketStatus.load(id)
  if (!status) {
    status = new MarketStatus(id)
    status.token = ctoken.id
    status.user = user.id
  }
  status.timestamp = event.block.timestamp
  status.entered = false
  status.save()
}

export function handleDistributedSupplierComp(event: DistributedSupplierComp): void {
  updateCompRewards(event.params.supplier, event.params.compDelta)
}

export function handleDistributedBorrowerComp(event: DistributedBorrowerComp): void {
  updateCompRewards(event.params.borrower, event.params.compDelta)
}
