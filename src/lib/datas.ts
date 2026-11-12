/** Datas no formato do banco: 'AAAA-MM-DD', sempre no horário local. */

export const paraIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const deIso = (s: string) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export const hojeIso = () => paraIso(new Date())

/** Dia `dia` do mês (mês pode passar de 11 ou ser negativo); ajusta para o último dia quando o mês é menor. */
export function dataNoMes(ano: number, mes: number, dia: number) {
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  return new Date(ano, mes, Math.min(dia, ultimo))
}

export const dataBr = (iso: string) => deIso(iso).toLocaleDateString('pt-BR')

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "Hoje", "Ontem", "Amanhã" ou "quarta, 12/11". */
export function diaAmigavel(iso: string) {
  const d = deIso(iso)
  const hoje = deIso(hojeIso())
  const dif = Math.round((d.getTime() - hoje.getTime()) / 864e5)
  if (dif === 0) return 'Hoje'
  if (dif === -1) return 'Ontem'
  if (dif === 1) return 'Amanhã'
  return `${SEMANA[d.getDay()]}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}
