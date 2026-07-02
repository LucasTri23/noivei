export const PLAN_IDS = {
  FREE:               'free',
  PREMIUM_MONTHLY:    'premium_monthly',
  PREMIUM_ONCE:       'premium_once',
  PLUS_MONTHLY:       'premium_plus_monthly',
  PLUS_ONCE:          'premium_plus_once',
} as const

export type PlanId = (typeof PLAN_IDS)[keyof typeof PLAN_IDS]

export const PLAN_NAMES: Record<PlanId, string> = {
  free:                 'Gratuito',
  premium_monthly:      'Premium',
  premium_once:         'Premium',
  premium_plus_monthly: 'Premium Plus',
  premium_plus_once:    'Premium Plus',
}

export const PAID_PLANS: PlanId[] = [
  'premium_monthly', 'premium_once', 'premium_plus_monthly', 'premium_plus_once',
]

export const PLUS_PLANS: PlanId[] = ['premium_plus_monthly', 'premium_plus_once']

export function isPaidPlan(plan: PlanId): boolean {
  return PAID_PLANS.includes(plan)
}

export function isPlusPlan(plan: PlanId): boolean {
  return PLUS_PLANS.includes(plan)
}
