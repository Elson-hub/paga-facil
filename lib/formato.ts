const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const reais = (v: number) => moeda.format(v || 0)

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/** Nome do mês; inclui o ano quando não é o ano atual. */
export function nomeDoMes(d: Date) {
  const nome = MESES[d.getMonth()]
  return d.getFullYear() === new Date().getFullYear() ? nome : `${nome} ${d.getFullYear()}`
}

export const somarMeses = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
