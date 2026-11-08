import { deliveryPlan, deliveryPose, interestPlan, interestPose } from "../../../game-data/zigguratDelivery";
import type { Ziggurat } from "../../../schemas/ziggurat";

const deliveries = new Map<number, ReturnType<typeof deliveryPlan>>();
const visits = new Map<number, ReturnType<typeof interestPlan>>();
const planFor = (slot: number) => {
  let plan = deliveries.get(slot);
  if (!plan) { plan = deliveryPlan(slot); deliveries.set(slot, plan); }
  return plan;
};

/** Sample the same saved timeline as the visible actors; audio never advances jobs. */
export const neighbourhoodAudio = (data: Pick<Ziggurat, "deliveries" | "interestVisits"> | undefined, now: number, clockOffset: number) => {
  const serverNow = now + clockOffset;
  const job = data?.deliveries.find(d => Date.parse(d.startsAt) <= serverNow && Date.parse(d.completesAt) > serverNow);
  const plan = job ? planFor(job.slot) : null;
  const walking = !!(job && plan && deliveryPose(plan, serverNow - Date.parse(job.startsAt)).farmer.moving) ||
    !!data?.interestVisits?.some(visit => {
      if (visit.slot === job?.slot || Date.parse(visit.startsAt) > serverNow || Date.parse(visit.completesAt) <= serverNow) return false;
      let visitPlan = visits.get(visit.slot);
      if (!visitPlan) { visitPlan = interestPlan(visit.slot); visits.set(visit.slot, visitPlan); }
      return interestPose(visitPlan, serverNow - Date.parse(visit.startsAt)).moving;
    });
  return { walking, pickup: job && plan ? {
    id: `neighbourhood:${job.id}`,
    at: Date.parse(job.startsAt) + plan.legs[0]!.duration - clockOffset,
  } : null };
};
