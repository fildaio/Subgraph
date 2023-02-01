import { BigInt , log} from "@graphprotocol/graph-ts"
import {
  CToken,
  Borrow,
  LiquidateBorrow,
  Mint,
  Redeem,
  RepayBorrow,
  Transfer
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
  User
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

const EVENT_LENGTH_ID = "event length"

export function handleBorrow(event: Borrow): void {
  let user = User.load(event.params.borrower.toHex())
  // user not exist
  if (!user) {
    user = new User(event.params.borrower.toHex())
    user.save()
  }

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
  borrowEvent.token = token.id
  borrowEvent.timestamp = event.block.timestamp
  borrowEvent.height = event.block.number
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
    tokenBalance.token = token.id
    tokenBalance.amount = ZERO_BD
  }

  tokenBalance.amount = convertTokenToDecimal(event.params.accountBorrows, token.decimals)
  tokenBalance.save()
}

export function handleLiquidateBorrow(event: LiquidateBorrow): void {
  let liquidator = User.load(event.params.liquidator.toHex())
  if (!liquidator) {
    liquidator = new User(event.params.liquidator.toHex())
    liquidator.save()
  }

  let collateral = Token.load(event.params.cTokenCollateral.toHex())
  // get collateral token failed,exit
  if (!collateral) return

  let borrower = User.load(event.params.borrower.toHex())
  if (!borrower) {
    borrower = new User(event.params.borrower.toHex())
    borrower.save()
  }

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
  liquidate.token = underlyingToken.id
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
    borrowBalance.token = underlyingToken.id
    borrowBalance.amount = ZERO_BD
  }
  borrowBalance.amount = borrowBalance.amount.minus(convertTokenToDecimal(event.params.repayAmount, underlyingToken.decimals))
  borrowBalance.save()
}

export function handleMint(event: Mint): void {
  let user = User.load(event.params.minter.toHex())
  if (!user) {
    user = new User(event.params.minter.toHex())
    user.save()
  }

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
  let user = User.load(event.params.redeemer.toHex())
  if (!user) {
    user = new User(event.params.redeemer.toHex())
    user.save()
  }

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
  let user = User.load(event.params.borrower.toHex())
  if (!user) {
    user = new User(event.params.borrower.toHex())
    user.save()
  }

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

  let payer = User.load(event.params.payer.toHex())
  if (!payer) {
    payer = new User(event.params.payer.toHex())
    payer.save()
  }

  let repayEvent = new RepayEvent(event.transaction.hash.toHex().concat("_Repay_").concat(eventLength.repay.toString()))
  repayEvent.repayAmount = convertTokenToDecimal(event.params.repayAmount, token.decimals)
  repayEvent.accountBorrows = convertTokenToDecimal(event.params.accountBorrows, token.decimals)
  repayEvent.totalBorrows = convertTokenToDecimal(event.params.totalBorrows, token.decimals)
  repayEvent.token = token.id
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
    tokenBalance.token = token.id
    tokenBalance.amount = ZERO_BD
  }

  tokenBalance.amount = convertTokenToDecimal(event.params.accountBorrows, token.decimals);
  tokenBalance.save()
}

export function handleTransfer(event: Transfer): void {
  // ignore Mint and Redeem event transfer
  if (event.params.from.toHex() == event.address.toHex() || event.params.to.toHex() == event.address.toHex()) return

  let from = User.load(event.params.from.toHex())
  if (!from) {
    from = new User(event.params.from.toHex())
    from.save()
  }

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

  let to = User.load(event.params.to.toHex())
  if (!to) {
    to = new User(event.params.to.toHex())
    to.save()
  }

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
