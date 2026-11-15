import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconChevronLeft, IconChevronRight, IconBuildingBank, IconPlus, IconMinus,
  IconArrowsExchange, IconReceipt, IconCreditCard
} from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import BotaoMais from '../componentes/BotaoMais'
import GraficosHome from '../componentes/GraficosHome'
import { supabase } from '../lib/supabase'
import { reais, nomeDoMes, somarMeses } from '../lib/formato'
import { estenderRecorrencias } from '../lib/lancamentos'

interface Resumo {
  saldoInicial: number
  saldoAtual: number
  saldoPrevisto: number
  receitas: { feito: number; previsto: number; pendentes: number; totalPendente: number }
  despesas: { feito: number; previsto: number; pendentes: number; totalPendente: number }
  faturas: { total: number; aberto: number }
  transferencias: { total: number; quantidade: number }
  temContas: boolean
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Calcula os números da Home para o mês.
 * Nesta primeira versão considera contas, receitas e despesas; cartões,
 * faturas e transferências entram nas próximas entregas.
 */
async function carregarResumo(mes: Date): Promise<Resumo> {
  const inicio = iso(mes)
  const fim = iso(somarMeses(mes, 1))

  const [contas, efetivados, doMes, cartao, pagos, transf] = await Promise.all([
    supabase.from('contas').select('saldo_inicial').eq('ativa', true),
    supabase.from('lancamentos').select('tipo, valor, data_efetivacao')
      .eq('efetivado', true).in('tipo', ['receita', 'despesa']).lt('data_efetivacao', fim),
    supabase.from('lancamentos').select('tipo, valor, efetivado')
      .in('tipo', ['receita', 'despesa']).gte('data_vencimento', inicio).lt('data_vencimento', fim),
    supabase.from('lancamentos').select('valor, fatura:faturas(situacao)')
      .eq('tipo', 'despesa_cartao').gte('data_vencimento', inicio).lt('data_vencimento', fim),
    supabase.from('pagamentos_fatura').select('valor, data').lt('data', fim),
    supabase.from('transferencias').select('valor').gte('data', inicio).lt('data', fim)
  ])

  const somaContas = (contas.data ?? []).reduce((s, c) => s + Number(c.saldo_inicial), 0)
  let antes = 0, noMes = 0
  for (const l of efetivados.data ?? []) {
    const v = l.tipo === 'receita' ? Number(l.valor) : -Number(l.valor)
    if (l.data_efetivacao < inicio) antes += v; else noMes += v
  }
  // Pagamentos de fatura saem da conta na data do pagamento.
  for (const p of pagos.data ?? []) {
    if (p.data < inicio) antes -= Number(p.valor); else noMes -= Number(p.valor)
  }

  const r = { feito: 0, previsto: 0, pendentes: 0, totalPendente: 0 }
  const d = { feito: 0, previsto: 0, pendentes: 0, totalPendente: 0 }
  for (const l of doMes.data ?? []) {
    const alvo = l.tipo === 'receita' ? r : d
    const v = Number(l.valor)
    alvo.previsto += v
    if (l.efetivado) alvo.feito += v
    else { alvo.pendentes++; alvo.totalPendente += v }
  }

  // Faturas de cartão que vencem no mês e ainda não foram pagas.
  const faturas = { total: 0, aberto: 0 }
  for (const l of (cartao.data ?? []) as unknown as { valor: number; fatura: unknown }[]) {
    // A fatura ligada pode vir como item ou como lista de um item.
    const f = (Array.isArray(l.fatura) ? l.fatura[0] : l.fatura) as { situacao?: string } | null
    faturas.total += Number(l.valor)
    if (f?.situacao !== 'paga' && f?.situacao !== 'paga_parcial') faturas.aberto += Number(l.valor)
  }

  const saldoInicial = somaContas + antes
  const saldoAtual = saldoInicial + noMes
  return {
    saldoInicial, saldoAtual,
    saldoPrevisto: saldoAtual + r.totalPendente - d.totalPendente - faturas.aberto,
    receitas: r, despesas: d, faturas,
    transferencias: {
      total: (transf.data ?? []).reduce((s, t) => s + Number(t.valor), 0),
      quantidade: (transf.data ?? []).length
    },
    temContas: (contas.data ?? []).length > 0
  }
}

export default function Home() {
  const [mes, setMes] = useState(() => somarMeses(new Date(), 0))
  const [aba, setAba] = useState<'despesa' | 'receita'>('despesa')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const ir = useNavigate()

  useEffect(() => {
    let vivo = true
    setResumo(null)
    estenderRecorrencias().then(() => carregarResumo(mes)).then(r => { if (vivo) setResumo(r) })
    return () => { vivo = false }
  }, [mes])

  const pend = aba === 'despesa' ? resumo?.despesas : resumo?.receitas
  const rotulo = aba === 'despesa' ? 'despesas' : 'receitas'

  return (
    <>
      <Topo
        estendido
        centro={
          <div className="seletor-mes">
            <button className="icone-btn" aria-label="Mês anterior" onClick={() => setMes(m => somarMeses(m, -1))}><IconChevronLeft /></button>
            <strong>{nomeDoMes(mes)}</strong>
            <button className="icone-btn" aria-label="Próximo mês" onClick={() => setMes(m => somarMeses(m, 1))}><IconChevronRight /></button>
          </div>
        }
      />
      <div className="pagina sobe">
        <section className="cartao">
          <div className="regua-linha"><i className="cheio" /><span /><i className="cheio" /><span className="tracejado" /><i /></div>
          <div className="regua">
            <div><div className="valor">{resumo ? reais(resumo.saldoInicial) : '…'}</div><small>Inicial</small></div>
            <div><div className="valor atual">{resumo ? reais(resumo.saldoAtual) : '…'}</div><small>Saldo atual</small></div>
            <div><div className="valor">{resumo ? reais(resumo.saldoPrevisto) : '…'}</div><small>Previsto</small></div>
          </div>
        </section>

        {resumo && !resumo.temContas && (
          <section className="cartao vazio">
            <IconBuildingBank size={32} />
            <strong>Cadastre sua primeira conta</strong>
            <span>Informe o saldo de hoje e o Paga Fácil passa a calcular tudo a partir dele.</span>
            <button className="btn btn-principal" onClick={() => ir('/contas/nova')}>Cadastrar conta</button>
          </section>
        )}

        <section className="cartao">
          <div className="abas">
            <button className={aba === 'despesa' ? 'ativa despesa' : ''} onClick={() => setAba('despesa')}>Despesas</button>
            <button className={aba === 'receita' ? 'ativa receita' : ''} onClick={() => setAba('receita')}>Receitas</button>
          </div>
          <div className="pendentes">
            <IconReceipt size={28} />
            {pend && pend.pendentes > 0 ? (
              <>
                <span>Você tem <b style={{ color: `var(--${aba})` }}>{pend.pendentes} {rotulo} pendentes</b> no total de</span>
                <strong>{reais(pend.totalPendente)}</strong>
                <button className="btn" onClick={() => ir(`/lancamentos?mes=${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}&tipo=${aba}&situacao=pendente`)}>Ver {rotulo} pendentes</button>
              </>
            ) : (
              <span className="aviso">Nenhuma {aba} pendente neste mês.</span>
            )}
          </div>
        </section>

        <section className="cartao">
          <h2>Visão geral</h2>
          <div className="linha-resumo">
            <span className="bolinha" style={{ background: 'var(--principal)' }}><IconBuildingBank size={20} /></span>
            <span className="nome">Contas<small>Previsto</small></span>
            <span className="valores">{reais(resumo?.saldoAtual ?? 0)}<small>{reais(resumo?.saldoPrevisto ?? 0)}</small></span>
          </div>
          <div className="linha-resumo">
            <span className="bolinha" style={{ background: 'var(--receita)' }}><IconPlus size={20} /></span>
            <span className="nome">Receitas<small>Previsto</small></span>
            <span className="valores">{reais(resumo?.receitas.feito ?? 0)}<small>{reais(resumo?.receitas.previsto ?? 0)}</small></span>
          </div>
          <div className="linha-resumo">
            <span className="bolinha" style={{ background: 'var(--despesa)' }}><IconMinus size={20} /></span>
            <span className="nome">Despesas<small>Previsto</small></span>
            <span className="valores">{reais(resumo?.despesas.feito ?? 0)}<small>{reais(resumo?.despesas.previsto ?? 0)}</small></span>
          </div>
          <div className="linha-resumo" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => ir('/cartoes')}>
            <span className="bolinha" style={{ background: '#5B3FD1' }}><IconCreditCard size={20} /></span>
            <span className="nome">Faturas de cartão<small>Em aberto</small></span>
            <span className="valores">{reais(resumo?.faturas.total ?? 0)}<small>{reais(resumo?.faturas.aberto ?? 0)}</small></span>
          </div>
          <div className="linha-resumo" role="button" tabIndex={0} style={{ cursor: 'pointer' }}
            onClick={() => ir(`/lancamentos?mes=${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}&tipo=todos&situacao=todas`)}>
            <span className="bolinha" style={{ background: '#E5A50A' }}><IconArrowsExchange size={20} /></span>
            <span className="nome">Transferências entre contas
              <small>{resumo?.transferencias.quantidade ? `${resumo.transferencias.quantidade} no mês · não alteram o saldo total` : 'Nenhuma no mês'}</small>
            </span>
            <span className="valores">{reais(resumo?.transferencias.total ?? 0)}</span>
          </div>
        </section>

        <GraficosHome mes={mes} />
      </div>
      <BotaoMais />
    </>
  )
}
