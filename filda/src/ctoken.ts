import { BigInt, Address, log} from "@graphprotocol/graph-ts"
import {
  CToken,
  Borrow,
  LiquidateBorrow,
  Mint,
  Redeem,
  RepayBorrow,
  Transfer,
  AccrueInterest
} from "../generated/templates/CToken/CToken"
import {
  Token,
  TokenBalance,
  Mint as MintEvent,
  Redeem as RedeemEvent,
  Borrow as BorrowEvent,
  RepayBorrow as RepayEvent,
  Liquidate,
  Transfer as TransferEvent,
  EventLength,
  AccrueInterest as AccrueInEvent,
  TokenInterest
} from "../generated/schema"
import {
  fetchTokenSymbol,
  fetchTokenName,
  fetchTokenDecimals,
  fetchUnderlyingToken,
  convertTokenToDecimal,
  ADDRESS_ZERO,
  ONE_BI,
  ZERO_BI,
  ZERO_BD,
  BI_18
} from './helper'

import {
  getUser
} from "./entities/user"

const EVENT_LENGTH_ID = "event length"

function updateTokenInterest(token: Address, account: Address): void {
  let accrueIn = AccrueInEvent.load(token.toHex().concat("_AccrueInterest"))
  if (!accrueIn) {
    return
  }

  let user = getUser(account)

  let id = token.toHex().concat("_").concat(account.toHex())
  let tokenInterest = TokenInterest.load(id)
  if (!tokenInterest) {
    let ctoken = Token.load(token.toHex())
    if (!ctoken) return

    tokenInterest = new TokenInterest(id)
    tokenInterest.user = user.id
    tokenInterest.token = ctoken.id
  }
  tokenInterest.borrowIndex = accrueIn.borrowIndex
  tokenInterest.timestamp = accrueIn.timestamp
  tokenInterest.save()
}

export function handleBorrow(event: Borrow): void {
  let user = getUser(event.params.borrower)

  let ctoken = Token.load(event.address.toHex())
  // get ctoken failed,exit
  if (!ctoken) return

  let token = Token.load(ctoken.underlying.toHex())
  // if token is not exist, exit
  if (!token) return

  // save borrow entity
  let eventLength = EventLength.load(EVENT_LENGTH_ID)
  if (!eventLength) {
    eventLength = new EventLength(EVENT_LENGTH_ID)
    eventLength.mint = ZERO_BI
    eventLength.redeem = ZERO_BI
    eventLength.borrow = ZERO_BI
    eventLength.repay = ZERO_BI
    eventLength.liquidate = ZERO_BI
    eventLength.transfer = ZERO_BI
  }
  let borrowEvent = new BorrowEvent(event.transaction.hash.toHex().concat("_Borrow_").concat(eventLength.borrow.toString()))
  borrowEvent.borrowAmount = convertTokenToDecimal(event.params.borrowAmount, token.decimals)
  borrowEvent.accountBorrows = convertTokenToDecimal(event.params.accountBorrows, token.decimals)
  borrowEvent.totalBorrows = convertTokenToDecimal(event.params.totalBorrows, token.decimals)
  borrowEvent.borrower = user.id
  borrowEvent.token = ctoken.id
  borrowEvent.timestamp = event.block.timestamp
  borrowEvent.height = event.block.number
  borrowEvent.txhash = event.transaction.hash.toHex()
  borrowEvent.save()

  eventLength.borrow = eventLength.borrow.plus(ONE_BI)
  eventLength.save()

  // update user token balance
  // token address_account address_handler
  let balanceID = ctoken.underlying.toHex().concat("_").concat(event.params.borrower.toHex()).concat("_Loan")
  let tokenBalance = TokenBalance.load(balanceID)
  if (!tokenBalance) {
    tokenBalance = new TokenBalance(balanceID)
    tokenBalance.handler = "Loan"
    tokenBalance.user = user.id
    tokenBalance.token = ctoken.id
    tokenBalance.amount = ZERO_BD
  }

  tokenBalance.amount = convertTokenToDecimal(event.params.accountBorrows, token.decimals)
  tokenBalance.save()

  updateTokenInterest(event.address, event.params.borrower);
}

export function handleLiquidateBorrow(event: LiquidateBorrow): void {
  let liquidator = getUser(event.params.liquidator)

  let collateral = Token.load(event.params.cTokenCollateral.toHex())
  // get collateral token failed,exit
  if (!collateral) return


  let borrower = getUser(event.params.borrower)

  let ctoken = Token.load(event.address.toHex())
  // get ctoken failed,exit
  if (!ctoken) return

  let underlyingToken = Token.load(ctoken.underlying.toHex())
  // if token is not exist, exit
  if (!underlyingToken) return

  // save liquidate entity
  let eventLength = EventLength.load(EVENT_LENGTH_ID)
  if (!eventLength) {
    eventLength = new EventLength(EVENT_LENGTH_ID)
    eventLength.mint = ZERO_BI
    eventLength.redeem = ZERO_BI
    eventLength.borrow = ZERO_BI
    eventLength.repay = ZERO_BI
    eventLength.liquidate = ZERO_BI
    eventLength.transfer = ZERO_BI
  }
  let liquidate = new Liquidate(event.transaction.hash.toHex().concat("_Liquidate_").concat(eventLength.liquidate.toString()))
  liquidate.repayAmount = convertTokenToDecimal(event.params.repayAmount, underlyingToken.decimals)
  liquidate.liquidator = liquidator.id
  liquidate.borrower = borrower.id
  liquidate.token = ctoken.id
  liquidate.collateral = collateral.id
  liquidate.timestamp = event.block.timestamp
  liquidate.height = event.block.number
  liquidate.seize = convertTokenToDecimal(event.params.seizeTokens, collateral.decimals)
  liquidate.save()

  eventLength.liquidate = eventLength.liquidate.plus(ONE_BI)
  eventLength.save()

  // only handle borrower borrow reduce, the collateral amount handled in transfer event
  let borrowBalanceID = ctoken.underlying.toHex().concat("_").concat(event.params.borrower.toHex()).concat("_Loan")
  let borrowBalance = TokenBalance.load(borrowBalanceID)
  if (!borrowBalance) {
    borrowBalance = new TokenBalance(borrowBalanceID)
    borrowBalance.handler = "Loan"
    borrowBalance.user = borrower.id
    borrowBalance.token = ctoken.id
    borrowBalance.amount = ZERO_BD
  }
  borrowBalance.amount = borrowBalance.amount.minus(convertTokenToDecimal(event.params.repayAmount, underlyingToken.decimals))
  borrowBalance.save()
}

export function handleMint(event: Mint): void {
  let user = getUser(event.params.minter)

  let token = Token.load(event.address.toHex())
  if (!token) return

  let underlyingToken = Token.load(token.underlying.toHex())
  if (!underlyingToken) return

  // save Mint entity
  let eventLength = EventLength.load(EVENT_LENGTH_ID)
  if (!eventLength) {
    eventLength = new EventLength(EVENT_LENGTH_ID)
    eventLength.mint = ZERO_BI
    eventLength.redeem = ZERO_BI
    eventLength.borrow = ZERO_BI
    eventLength.repay = ZERO_BI
    eventLength.liquidate = ZERO_BI
    eventLength.transfer = ZERO_BI
  }

  let mintEvent = new MintEvent(event.transaction.hash.toHex().concat("_Mint_").concat(eventLength.mint.toString()))
  mintEvent.amount = convertTokenToDecimal(event.params.mintTokens, token.decimals)
  mintEvent.underlyingAmount = convertTokenToDecimal(event.params.mintAmount, underlyingToken.decimals)
  mintEvent.token = token.id
  mintEvent.minter = user.id
  mintEvent.timestamp = event.block.timestamp
  mintEvent.height = event.block.number
  mintEvent.save()

  eventLength.mint = eventLength.mint.plus(ONE_BI)
  eventLength.save()

  // token address_account address_handler
  let balanceID = event.address.toHex().concat("_").concat(event.params.minter.toHex()).concat("_Deposit")
  let tokenBalance = TokenBalance.load(balanceID)
  if (!tokenBalance) {
    tokenBalance = new TokenBalance(balanceID)
    tokenBalance.handler = "Deposit"
    tokenBalance.user = user.id
    tokenBalance.token = token.id
    tokenBalance.amount = ZERO_BD
  }

  tokenBalance.amount = tokenBalance.amount.plus(convertTokenToDecimal(event.params.mintTokens, token.decimals))
  tokenBalance.save()
}

export function handleRedeem(event: Redeem): void {
  let user = getUser(event.params.redeemer)

  let token = Token.load(event.address.toHex())
  if (!token) return

  let underlyingToken = Token.load(token.underlying.toHex())
  if (!underlyingToken) return

  // save Redeem entity
  let eventLength = EventLength.load(EVENT_LENGTH_ID)
  if (!eventLength) {
    eventLength = new EventLength(EVENT_LENGTH_ID)
    eventLength.mint = ZERO_BI
    eventLength.redeem = ZERO_BI
    eventLength.borrow = ZERO_BI
    eventLength.repay = ZERO_BI
    eventLength.liquidate = ZERO_BI
    eventLength.transfer = ZERO_BI
  }

  let redeemEvent = new RedeemEvent(event.transaction.hash.toHex().concat("_Redeem_").concat(eventLength.redeem.toString()))
  redeemEvent.amount = convertTokenToDecimal(event.params.redeemTokens, token.decimals)
  redeemEvent.underlyingAmount = convertTokenToDecimal(event.params.redeemAmount, underlyingToken.decimals)
  redeemEvent.token = token.id
  redeemEvent.redeemer = user.id
  redeemEvent.timestamp = event.block.timestamp
  redeemEvent.height = event.block.number
  redeemEvent.save()

  eventLength.redeem = eventLength.redeem.plus(ONE_BI)
  eventLength.save()

  // sub user's collateral
  // token address_account address_handler
  let balanceID = event.address.toHex().concat("_").concat(event.params.redeemer.toHex()).concat("_Deposit")
  let tokenBalance = TokenBalance.load(balanceID)
  if (!tokenBalance) {
    tokenBalance = new TokenBalance(balanceID)
    tokenBalance.handler = "Deposit"
    tokenBalance.user = user.id
    tokenBalance.token = token.id
    tokenBalance.amount = ZERO_BD
  }

  tokenBalance.amount = tokenBalance.amount.minus(convertTokenToDecimal(event.params.redeemTokens, token.decimals))
  tokenBalance.save()
}

export function handleRepayBorrow(event: RepayBorrow): void {
  let user = getUser(event.params.borrower)

  let ctoken = Token.load(event.address.toHex())
  // get ctoken failed,exit
  if (!ctoken) return

  let token = Token.load(ctoken.underlying.toHex())
  if (!token) return

  // save repay entity
  let eventLength = EventLength.load(EVENT_LENGTH_ID)
  if (!eventLength) {
    eventLength = new EventLength(EVENT_LENGTH_ID)
    eventLength.mint = ZERO_BI
    eventLength.redeem = ZERO_BI
    eventLength.borrow = ZERO_BI
    eventLength.repay = ZERO_BI
    eventLength.liquidate = ZERO_BI
    eventLength.transfer = ZERO_BI
  }

  let payer = getUser(event.params.payer)

  let repayEvent = new RepayEvent(event.transaction.hash.toHex().concat("_Repay_").concat(eventLength.repay.toString()))
  repayEvent.repayAmount = convertTokenToDecimal(event.params.repayAmount, token.decimals)
  repayEvent.accountBorrows = convertTokenToDecimal(event.params.accountBorrows, token.decimals)
  repayEvent.totalBorrows = convertTokenToDecimal(event.params.totalBorrows, token.decimals)
  repayEvent.token = ctoken.id
  repayEvent.borrower = user.id
  repayEvent.payer = payer.id
  repayEvent.timestamp = event.block.timestamp
  repayEvent.height = event.block.number
  repayEvent.save()

  eventLength.repay = eventLength.repay.plus(ONE_BI)
  eventLength.save()

  // token address_account address_handler
  let balanceID = ctoken.underlying.toHex().concat("_").concat(event.params.borrower.toHex()).concat("_Loan")
  let tokenBalance = TokenBalance.load(balanceID)
  if (!tokenBalance) {
    tokenBalance = new TokenBalance(balanceID)
    tokenBalance.handler = "Loan"
    tokenBalance.user = user.id
    tokenBalance.token = ctoken.id
    tokenBalance.amount = ZERO_BD
  }

  tokenBalance.amount = convertTokenToDecimal(event.params.accountBorrows, token.decimals);
  tokenBalance.save()

  updateTokenInterest(event.address, event.params.borrower);
}

export function handleTransfer(event: Transfer): void {
  // ignore Mint and Redeem event transfer
  if (event.params.from.toHex() == event.address.toHex() || event.params.to.toHex() == event.address.toHex()) return

  let from = getUser(event.params.from)

  let token = Token.load(event.address.toHex())
  if (!token) return

  // token address_account address_handler
  let balanceID = event.address.toHex().concat("_").concat(event.params.from.toHex()).concat("_Deposit")
  let tokenBalance = TokenBalance.load(balanceID)
  if (!tokenBalance) {
    tokenBalance = new TokenBalance(balanceID)
    tokenBalance.handler = "Deposit"
    tokenBalance.user = from.id
    tokenBalance.token = token.id
    tokenBalance.amount = ZERO_BD
  }

  let amount = convertTokenToDecimal(event.params.amount, token.decimals)
  tokenBalance.amount = tokenBalance.amount.minus(amount)
  tokenBalance.save()

  let to = getUser(event.params.to)

  // token address_account address_handler
  let toBalanceID = event.address.toHex().concat("_").concat(event.params.to.toHex()).concat("_Deposit")
  let toTokenBalance = TokenBalance.load(toBalanceID)
  if (!toTokenBalance) {
    toTokenBalance = new TokenBalance(toBalanceID)
    toTokenBalance.handler = "Deposit"
    toTokenBalance.user = to.id
    toTokenBalance.token = token.id
    toTokenBalance.amount = ZERO_BD
  }

  toTokenBalance.amount = toTokenBalance.amount.plus(amount);
  toTokenBalance.save()

  // save repay entity
  let eventLength = EventLength.load(EVENT_LENGTH_ID)
  if (!eventLength) {
    eventLength = new EventLength(EVENT_LENGTH_ID)
    eventLength.mint = ZERO_BI
    eventLength.redeem = ZERO_BI
    eventLength.borrow = ZERO_BI
    eventLength.repay = ZERO_BI
    eventLength.liquidate = ZERO_BI
    eventLength.transfer = ZERO_BI
  }

  let transferEvent = new TransferEvent(event.transaction.hash.toHex().concat("_Transfer_").concat(eventLength.transfer.toString()))
  transferEvent.amount = amount
  transferEvent.token = token.id
  transferEvent.from = from.id
  transferEvent.to = to.id
  transferEvent.timestamp = event.block.timestamp
  transferEvent.height = event.block.number
  transferEvent.save()

  eventLength.transfer = eventLength.transfer.plus(ONE_BI)
  eventLength.save()
}

export function handleAccrueInterest(event: AccrueInterest): void {
  let token = Token.load(event.address.toHex())
  if (!token) return

  let id = event.address.toHex().concat("_AccrueInterest")
  let accrueIn = AccrueInEvent.load(id)
  if (!accrueIn) {
    accrueIn = new AccrueInEvent(id)
    accrueIn.token = token.id
  }
  accrueIn.cashPrior = event.params.cashPrior
  accrueIn.interestAccumulated = event.params.interestAccumulated
  accrueIn.borrowIndex = event.params.borrowIndex
  accrueIn.totalBorrows = event.params.totalBorrows
  accrueIn.timestamp = event.block.timestamp
  accrueIn.save()
}

