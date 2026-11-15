import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import CampoValor from '../componentes/CampoValor'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_CONTA, contaEmUso, type CategoriaConta } from '../lib/contas'

export default function ContaForm() {
  const { id } = useParams()
  const nova = !id
  const ir = useNavigate()

  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<CategoriaConta>('corrente')
  const [saldo, setSaldo] = useState(0)
  const [cheque, setCheque] = useState(0)
  const [ativa, setAtiva] = useState(true)
  const [carregando, setCarregando] = useState(!nova)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (nova) return
    supabase.from('contas').select('descricao, tipo, saldo_inicial, limite_cheque_especial, ativa').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { setErro('Conta não encontrada.'); setCarregando(false); return }
        setDescricao(data.descricao)
        setTipo(data.tipo)
        setSaldo(Number(data.saldo_inicial))
        setCheque(Number(data.limite_cheque_especial))
        setAtiva(data.ativa)
        setCarregando(false)
      })
  }, [id, nova])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!descricao.trim()) return setErro('Informe a descrição da conta.')
    setErro(''); setSalvando(true)
    const dados = { descricao: descricao.trim(), tipo, saldo_inicial: saldo, limite_cheque_especial: cheque, ativa }
    const { error } = nova
      ? await supabase.from('contas').insert(dados)
      : await supabase.from('contas').update(dados).eq('id', id)
    setSalvando(false)
    if (error) return setErro('Não foi possível salvar. Verifique sua conexão e tente de novo.')
    ir('/contas', { replace: true })
  }

  async function excluir() {
    if (!id) return
    setErro('')
    if (await contaEmUso(id)) {
      if (window.confirm('Esta conta já tem movimentações, por isso não pode ser excluída. Deseja desativá-la? Ela deixa de aparecer nas listas, mas o histórico é mantido.')) {
        const { error } = await supabase.from('contas').update({ ativa: false }).eq('id', id)
        if (error) return setErro('Não foi possível desativar.')
        ir('/contas', { replace: true })
      }
      return
    }
    if (!window.confirm(`Excluir a conta "${descricao}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('contas').delete().eq('id', id)
    if (error) return setErro('Não foi possível excluir.')
    ir('/contas', { replace: true })
  }

  const voltar = (
    <button className="icone-btn" aria-label="Voltar" onClick={() => ir('/contas')}><IconArrowLeft size={22} /></button>
  )

  return (
    <>
      <Topo titulo={nova ? 'Nova conta' : 'Editar conta'} esquerda={voltar} />
      <div className="pagina">
        {carregando ? <p className="aviso">Carregando…</p> : (
          <form className="cartao formulario" onSubmit={salvar}>
            <div className="campo">
              <label htmlFor="descricao">Descrição</label>
              <input id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)}
                placeholder="Ex.: Nubank, Itaú, Carteira" maxLength={60} autoFocus={nova} />
            </div>

            <div className="campo">
              <label htmlFor="tipo">Categoria</label>
              <select id="tipo" value={tipo} onChange={e => setTipo(e.target.value as CategoriaConta)}>
                {CATEGORIAS_CONTA.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <CampoValor id="saldo" rotulo="Saldo inicial" valor={saldo} onChange={setSaldo} permitirNegativo
              ajuda="O saldo da conta hoje. Toque em + / − se a conta estiver negativa." />

            <CampoValor id="cheque" rotulo="Cheque especial" valor={cheque} onChange={setCheque}
              ajuda="Limite do cheque especial. Deixe 0,00 se a conta não tiver." />

            {!nova && (
              <label className="interruptor">
                <input type="checkbox" checked={ativa} onChange={e => setAtiva(e.target.checked)} />
                <span>Conta ativa</span>
              </label>
            )}

            {erro && <p className="erro">{erro}</p>}

            <button className="btn btn-principal btn-bloco" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            {!nova && (
              <button type="button" className="btn btn-bloco" style={{ color: 'var(--despesa)' }} onClick={excluir}>Excluir conta</button>
            )}
          </form>
        )}
      </div>
    </>
  )
}
