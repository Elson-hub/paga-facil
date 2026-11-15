import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconArrowDown, IconArrowsExchange } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import CampoValor from '../componentes/CampoValor'
import { hojeIso } from '../lib/datas'
import { reais } from '../lib/formato'
import { listarContas, type ContaComSaldo } from '../lib/contas'
import { buscarTransferencia, salvarTransferencia, excluirTransferencia } from '../lib/transferencias'

export default function TransferenciaForm() {
  const { id } = useParams()
  const novo = !id
  const ir = useNavigate()

  const [contas, setContas] = useState<ContaComSaldo[] | null>(null)
  const [valor, setValor] = useState(0)
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [data, setData] = useState(hojeIso())
  const [descricao, setDescricao] = useState('')
  const [carregando, setCarregando] = useState(!novo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    listarContas().then(lista => {
      const ativas = lista.filter(c => c.ativa)
      setContas(lista)
      if (novo && ativas.length) {
        setOrigem(ativas[0].id)
        setDestino(ativas[1]?.id ?? '')
      }
    }).catch(() => setContas([]))
  }, [novo])

  useEffect(() => {
    if (!id) return
    buscarTransferencia(id).then(t => {
      setValor(t.valor); setOrigem(t.conta_origem_id); setDestino(t.conta_destino_id)
      setData(t.data); setDescricao(t.descricao ?? ''); setCarregando(false)
    }).catch(() => { setErro('Transferência não encontrada.'); setCarregando(false) })
  }, [id])

  // Ao editar, a conta pode estar desativada: ela continua na lista.
  const opcoes = (contas ?? []).filter(c => c.ativa || c.id === origem || c.id === destino)
  const contaOrigem = contas?.find(c => c.id === origem)
  const contaDestino = contas?.find(c => c.id === destino)

  function inverter() { setOrigem(destino); setDestino(origem) }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (valor <= 0) return setErro('Informe o valor.')
    if (!origem || !destino) return setErro('Escolha as duas contas.')
    if (origem === destino) return setErro('A conta de origem e a de destino precisam ser diferentes.')
    if (!data) return setErro('Informe a data.')
    setErro(''); setSalvando(true)
    try {
      await salvarTransferencia({ conta_origem_id: origem, conta_destino_id: destino, data, valor, descricao: descricao.trim() || null }, id)
      ir(-1)
    } catch {
      setErro('Não foi possível salvar. Verifique sua conexão e tente de novo.')
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!id || !window.confirm('Excluir esta transferência? O valor volta para a conta de origem.')) return
    try { await excluirTransferencia(id); ir(-1) }
    catch { setErro('Não foi possível excluir.') }
  }

  const voltar = <button type="button" className="icone-btn" aria-label="Voltar" onClick={() => ir(-1)}><IconArrowLeft size={22} /></button>
  const ativas = (contas ?? []).filter(c => c.ativa)

  return (
    <>
      <div className="cabecalho-lanc transferencia">
        <Topo titulo={novo ? 'Nova transferência' : 'Editar transferência'} esquerda={voltar} />
      </div>
      <div className="pagina">
        {carregando ? <p className="aviso">Carregando…</p> : (
          <form className="formulario" onSubmit={salvar}>
            {contas && ativas.length < 2 && novo && (
              <p className="erro caixa-aviso">Para transferir, cadastre pelo menos duas contas. <Link to="/contas/nova">Cadastrar conta</Link></p>
            )}

            <section className="cartao formulario">
              <CampoValor id="valor" rotulo="Valor" valor={valor} onChange={setValor} />

              <div className="campo">
                <label htmlFor="origem">Sai da conta</label>
                <select id="origem" value={origem} onChange={e => setOrigem(e.target.value)}>
                  <option value="">Escolher conta</option>
                  {opcoes.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
                {contaOrigem && <small className="ajuda">Saldo atual: {reais(contaOrigem.saldo_atual)}</small>}
              </div>

              <button type="button" className="btn-inverter" onClick={inverter} aria-label="Inverter contas">
                <IconArrowDown size={18} />inverter
              </button>

              <div className="campo">
                <label htmlFor="destino">Entra na conta</label>
                <select id="destino" value={destino} onChange={e => setDestino(e.target.value)}>
                  <option value="">Escolher conta</option>
                  {opcoes.map(c => <option key={c.id} value={c.id} disabled={c.id === origem}>{c.descricao}</option>)}
                </select>
                {contaDestino && <small className="ajuda">Saldo atual: {reais(contaDestino.saldo_atual)}</small>}
              </div>

              <div className="campo">
                <label htmlFor="data">Data</label>
                <input id="data" type="date" value={data} onChange={e => setData(e.target.value)} required />
              </div>

              <div className="campo">
                <label htmlFor="descricao">Descrição (opcional)</label>
                <input id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={80}
                  placeholder="Ex.: Reserva de emergência" />
              </div>

              {valor > 0 && contaOrigem && contaDestino && origem !== destino && (
                <p className="destaque-info">
                  <IconArrowsExchange size={16} style={{ verticalAlign: '-3px' }} /> {reais(valor)} saem de <b>{contaOrigem.descricao}</b> e entram em <b>{contaDestino.descricao}</b>. Não conta como receita nem despesa.
                </p>
              )}
            </section>

            {erro && <p className="erro">{erro}</p>}
            <button className="btn btn-bloco btn-tipo transferencia" disabled={salvando || (novo && ativas.length < 2)}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            {!novo && (
              <button type="button" className="btn btn-bloco" style={{ color: 'var(--despesa)' }} onClick={excluir}>Excluir</button>
            )}
          </form>
        )}
      </div>
    </>
  )
}
