/* eslint-disable prefer-const */
import { log, BigInt, BigDecimal, Address, ethereum } from '@graphprotocol/graph-ts'
import { GaugeController } from '../generated/GaugeController/GaugeController'
import { VotingEscrow } from '../generated/GaugeController/VotingEscrow'

export let WEEK = BigInt.fromI32(604800)
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export interface UserLock {
  slope: BigInt,
  lock_end: BigInt
}

export function fetchGaugeRelativeWeight(controller: Address, gauge: Address): BigInt {
  let contract = GaugeController.bind(controller)

  let weight = 0
  let result = contract.try_gauge_relative_weight(gauge)
  if (!result.reverted) {
    weight = result.value
  }
  return BigInt.fromI32(weight as i32);
}

export function fetchVotingEscrow(controller: Address): Address {
  let contract = GaugeController.bind(controller)
  let vetoken = ADDRESS_ZERO
  let result = contract.try_voting_escrow()
  if (!result.reverted) {
    vetoken = result.value.toHex()
  }
  return Address.fromString(vetoken)
}

export function fetchUserLastSlope(vetoken: Address, user: Address): BigInt {
  let contract = VotingEscrow.bind(vetoken)
  let slope = BigInt.fromI32(0)
  let result = contract.try_get_last_user_slope(user)
  if (!result.reverted) {
    slope = result.value
  }

  return slope
}

export function fetchUserLockend(vetoken: Address, user: Address): BigInt {
  let contract = VotingEscrow.bind(vetoken)
  let lock_end = BigInt.fromI32(0)
  let result = contract.try_locked__end(user)
  if (!result.reverted) {
    lock_end = result.value
  }

  return lock_end
}

