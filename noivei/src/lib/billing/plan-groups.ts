// Chave de agrupamento efetiva de um plano: planos com o mesmo group_key viram
// variantes de cobrança do mesmo card (toggle mensal/único etc.); um plano sem
// group_key (NULL) vira seu próprio grupo, usando o próprio id como chave — é o caso
// do Gratuito hoje, e de qualquer novo plano "avulso" que o admin criar sem informar
// group_key. Usado tanto na tela do casal (plan-selector) quanto no admin (matriz de
// comparação) pra garantir que os dois lados calculam os mesmos grupos.
export function effectiveGroupKey(plan: { id: string; group_key: string | null }): string {
  return plan.group_key || plan.id
}

// Agrupa uma lista de planos pelo group_key efetivo, preservando a ordem de
// chegada — usado em qualquer tela que renderiza os planos como cards com
// variantes de cobrança (toggle mensal/único), pra garantir que todas calculam
// os mesmos grupos a partir da mesma lista de planos ativos.
export function groupPlans<T extends { id: string; group_key: string | null }>(plans: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const plan of plans) {
    const key = effectiveGroupKey(plan)
    const list = groups.get(key) ?? []
    list.push(plan)
    groups.set(key, list)
  }
  return groups
}
