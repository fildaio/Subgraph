import { BigInt, Address } from "@graphprotocol/graph-ts"
import { User } from "../../generated/schema"
import {
  ZERO_BI
} from '../helper'

export function getUser(account: Address): User {
  let userId = account.toHex()
  let user = User.load(userId)
  // user not exist
  if (!user) {
    user = new User(userId)
    user.compRewards = ZERO_BI
    user.save()
  }

  return user
}

export function updateCompRewards(account: Address, amount: BigInt): void {
  let user = getUser(account)
  user.compRewards += amount
  user.save()
}
