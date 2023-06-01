import { BigInt, Address, log } from "@graphprotocol/graph-ts"
import {
  VoteForGauge,
  NewGauge
} from "../generated/GaugeController/GaugeController"
import {
  Vote,
  Gauge,
  User
} from "../generated/schema"
import {
  fetchGaugeRelativeWeight,
  fetchVotingEscrow,
  fetchUserLastSlope,
  fetchUserLockend,
  WEEK,
  ADDRESS_ZERO
} from './helper'

export function handleNewGauge(event: NewGauge): void {
  let gauge = new Gauge(event.params.addr.toHex())
  gauge.type = event.params.gauge_type + BigInt.fromI32(1)
  gauge.save()
}

export function handleVoteForGauge(event: VoteForGauge): void {
  let user = User.load(event.params.user.toHex())
  if (user === null) {
    user = new User(event.params.user.toHex())
    user.save()
  }

  // save vote
  let id = event.params.user.toHex().concat("_").concat(event.params.gauge_addr.toHex())
          .concat("_").concat(event.params.time.toHex())
  let vote = new Vote(id)
  vote.weight = event.params.weight
  vote.gauge = event.params.gauge_addr.toHex()
  vote.user = user.id
  vote.timestamp = event.params.time

  let vetoken = fetchVotingEscrow(event.address)
  if (vetoken.toHex() == ADDRESS_ZERO) {
    return
  }

  let slope = fetchUserLastSlope(vetoken, event.params.user)
  let lock_end = fetchUserLockend(vetoken, event.params.user)
  let next_time = (event.params.time + WEEK) / WEEK * WEEK
  vote.roundtime = next_time
  vote.amount = slope * (lock_end - next_time) * event.params.weight / BigInt.fromI32(10000)

  vote.save()
}
