import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import CampoValor from '../componentes/CampoValor'
import { supabase } from '../lib/supabase'
import { BANDEIRAS, CORES_CARTAO, faturaDaData, cartaoEmUso, type TipoVencimento } from '../lib/cartoes'

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const dataLonga = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })

export default function CartaoForm() {
  const { id } = useParams()
  const novo = !id
  const ir = useNavigate()

  const [nome, setNome] = useState('')
  const [bandeira, setBandeira] = useState('Mastercard')
  const [limite, setLimite] = useState(0)
  const [contaId, setContaId] = useState('')
  const [diaFechamento, setDiaFechamento] = useState(5)
  const [tipoVenc, setTipoVenc] = useState<TipoVencimento>('fixo')
  const [diaVencimento, setDiaVencimento] = useState(15)
  const [diasApos, setDiasApos] = useState(10)
  const [cor, setCor] = useState(CORES_CARTAO[0])
  const [ativo, setAtivo] = useState(true)
  const [contas, setContas] = useState<{ id: string; descricao: string }[]>([])
  const [carregando, setCarregando] = useState(!novo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('contas').select('id, descricao').eq('ativa', true).order('descricao')
      .then(({ data }) => setContas(data ?? []))
  }, [])

  useEffect(() => {
    if (novo) return
    supabase.from('cartoes')
      .select('nome, bandeira, limite, conta_pagamento_id, dia_fechamento, tipo_vencimento, dia_vencimento, dias_apos_fechamento, cor, ativo')
      .eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { setErro('Cartão não encontrado.'); setCarregando(false); return }
        setNome(data.nome); setBandeira(data.bandeira || 'Outra'); setLimite(Number(data.limite))
        setContaId(data.conta_pagamento_id ?? ''); setDiaFechamento(data.dia_fechamento)
        setTipoVenc(data.tipo_vencimento); setDiaVencimento(data.dia_vencimento ?? 15)
        setDiasApos(data.dias_apos_fechamento ?? 10); setCor(data.cor || CORES_CARTAO[0]); setAtivo(data.ativo)
        setCarregando(false)
      })
  }, [id, novo])

  const previa = faturaDaData({
    dia_fechamento: diaFechamento, tipo_vencimento: tipoVenc,
    dia_vencimento: diaVencimento, dias_apos_fechamento: diasApos
  }, new Date())

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Informe o nome do cartão.')
    if (tipoVenc === 'variavel' && (diasApos < 1 || diasApos > 60)) return setErro('Os dias após o fechamento devem ficar entre 1 e 60.')
    setErro(''); setSalvando(true)
    const dados = {
      nome: nome.trim(), bandeira, limite, conta_pagamento_id: contaId || null,
      dia_fechamento: diaFechamento, tipo_vencimento: tipoVenc,
      dia_vencimento: tipoVenc === 'fixo' ? diaVencimento : null,
      dias_apos_fechamento: tipoVenc === 'variavel' ? diasApos : null,
      cor, ativo
    }
    const { error } = novo
      ? await supabase.from('cartoes').insert(dados)
      : await supabase.from('cartoes').update(dados).eq('id', id)
    setSalvando(false)
    if (error) return setErro('Não foi possível salvar. Verifique sua conexão e tente de novo.')
    ir('/cartoes', { replace: true })
  }

  async function excluir() {
    if (!id) return
    setErro('')
    if (await cartaoEmUso(id)) {
      if (window.confirm('Este cartão já tem compras ou faturas, por isso não pode ser excluído. Deseja desativá-lo? O histórico é mantido.')) {
        const { error } = await supabase.from('cartoes').update({ ativo: false }).eq('id', id)
        if (error) return setErro('Não foi possível desativar.')
        ir('/cartoes', { replace: true })
      }
      return
    }
    if (!window.confirm(`Excluir o cartão "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('cartoes').delete().eq('id', id)
    if (error) return setErro('Não foi possível excluir.')
    ir('/cartoes', { replace: true })
  }

  const voltar = <button className="icone-btn" aria-label="Voltar" onClick={() => ir('/cartoes')}><IconArrowLeft size={22} /></button>

  return (
    <>
      <Topo titulo={novo ? 'Novo cartão' : 'Editar cartão'} esquerda={voltar} />
      <div className="pagina">
        {carregando ? <p className="aviso">Carregando…</p> : (
          <form className="formulario" onSubmit={salvar}>
            <div className="cc-frente cc-previa" style={{ background: cor }}>
              <div className="cc-topo"><strong>{nome || 'Nome do cartão'}</strong><span>{bandeira}</span></div>
              <div className="cc-datas">
                <span><small>Fecha</small>{dataLonga(previa.fechamento)}</span>
                <span><small>Vence</small>{dataLonga(previa.vencimento)}</span>
              </div>
            </div>

            <section className="cartao formulario">
              <div className="campo">
                <label htmlFor="nome">Nome</label>
                <input id="nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={40}
                  placeholder="Ex.: Nubank, Itaú Visa" autoFocus={novo} />
              </div>
              <div className="campo">
                <label htmlFor="bandeira">Bandeira</label>
                <select id="bandeira" value={bandeira} onChange={e => setBandeira(e.target.value)}>
                  {BANDEIRAS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <CampoValor id="limite" rotulo="Limite" valor={limite} onChange={setLimite} />
              <div className="campo">
                <label htmlFor="conta">Conta de pagamento</label>
                <select id="conta" value={contaId} onChange={e => setContaId(e.target.value)}>
                  <option value="">Escolher na hora de pagar</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
                <small className="ajuda">Conta sugerida quando você for pagar a fatura.</small>
              </div>
            </section>

            <section className="cartao formulario">
              <h2>Fatura</h2>
              <div className="campo">
                <label htmlFor="fechamento">Dia de fechamento</label>
                <select id="fechamento" value={diaFechamento} onChange={e => setDiaFechamento(Number(e.target.value))}>
                  {DIAS.map(d => <option key={d} value={d}>Dia {d}</option>)}
                </select>
                <small className="ajuda">Compras até este dia, inclusive, entram na fatura do mês.</small>
              </div>

              <div className="campo">
                <label>Vencimento</label>
                <div className="segmentos" role="radiogroup" aria-label="Tipo de vencimento">
                  <button type="button" role="radio" aria-checked={tipoVenc === 'fixo'} className={tipoVenc === 'fixo' ? 'ativo' : ''}
                    onClick={() => setTipoVenc('fixo')}>Dia fixo</button>
                  <button type="button" role="radio" aria-checked={tipoVenc === 'variavel'} className={tipoVenc === 'variavel' ? 'ativo' : ''}
                    onClick={() => setTipoVenc('variavel')}>Após o fechamento</button>
                </div>
              </div>

              {tipoVenc === 'fixo' ? (
                <div className="campo">
                  <label htmlFor="vencimento">Dia de vencimento</label>
                  <select id="vencimento" value={diaVencimento} onChange={e => setDiaVencimento(Number(e.target.value))}>
                    {DIAS.map(d => <option key={d} value={d}>Dia {d}</option>)}
                  </select>
                </div>
              ) : (
                <div className="campo">
                  <label htmlFor="dias">Quantos dias depois do fechamento vence</label>
                  <input id="dias" type="number" inputMode="numeric" min={1} max={60} value={diasApos}
                    onChange={e => setDiasApos(Number(e.target.value))} />
                </div>
              )}

              <p className="destaque-info">
                Próxima fatura: fecha em <b>{dataLonga(previa.fechamento)}</b> e vence em <b>{dataLonga(previa.vencimento)}</b>.
              </p>
            </section>

            <section className="cartao formulario">
              <div className="campo">
                <label>Cor</label>
                <div className="grade-cores">
                  {CORES_CARTAO.map(c => (
                    <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={cor === c}
                      style={{ background: c }} onClick={() => setCor(c)}>
                      {cor === c && <IconCheck size={18} color="#fff" />}
                    </button>
                  ))}
                </div>
              </div>
              {!novo && (
                <label className="interruptor">
                  <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
                  <span>Cartão ativo</span>
                </label>
              )}
            </section>

            {erro && <p className="erro">{erro}</p>}
            <button className="btn btn-principal btn-bloco" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            {!novo && (
              <button type="button" className="btn btn-bloco" style={{ color: 'var(--despesa)' }} onClick={excluir}>Excluir cartão</button>
            )}
          </form>
        )}
      </div>
    </>
  )
}
