import { useEffect, useRef, useState } from 'react'
import { IconPaperclip, IconFileTypePdf, IconTrash, IconPhoto } from '@tabler/icons-react'
import {
  enviarAnexo, listarAnexos, linksDosAnexos, excluirAnexo, ehImagem, tamanhoLegivel,
  LIMITE_BYTES, TIPOS_ACEITOS, type Anexo
} from '../lib/anexos'

interface Props {
  /** Lançamento já salvo: os arquivos são enviados na hora. */
  lancamentoId?: string
  /** Lançamento novo: os arquivos ficam esperando até salvar. */
  pendentes: File[]
  onPendentes: (f: File[]) => void
}

export default function Anexos({ lancamentoId, pendentes, onPendentes }: Props) {
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [links, setLinks] = useState<Map<string, string>>(new Map())
  const [previas, setPrevias] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const entrada = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!lancamentoId) return
    listarAnexos(lancamentoId).then(async a => {
      setAnexos(a)
      setLinks(await linksDosAnexos(a.map(x => x.caminho)))
    }).catch(() => setErro('Não foi possível carregar os anexos.'))
  }, [lancamentoId])

  // Miniaturas dos arquivos que ainda não foram enviados.
  useEffect(() => {
    const urls = pendentes.map(f => ehImagem(f.type) ? URL.createObjectURL(f) : '')
    setPrevias(urls)
    return () => urls.forEach(u => u && URL.revokeObjectURL(u))
  }, [pendentes])

  async function escolher(lista: FileList | null) {
    if (!lista?.length) return
    setErro('')
    const arquivos = [...lista]
    const grandes = arquivos.filter(f => f.size > LIMITE_BYTES && !ehImagem(f.type))
    if (grandes.length) setErro('Arquivos acima de 10 MB não podem ser anexados.')
    const validos = arquivos.filter(f => !grandes.includes(f))
    if (!lancamentoId) { onPendentes([...pendentes, ...validos]); return }
    setEnviando(true)
    try {
      const novos: Anexo[] = []
      for (const f of validos) novos.push(await enviarAnexo(lancamentoId, f))
      setAnexos(a => [...a, ...novos])
      const l = await linksDosAnexos(novos.map(n => n.caminho))
      setLinks(m => new Map([...m, ...l]))
    } catch (e) {
      setErro((e as Error)?.message === 'grande' ? 'Arquivo acima de 10 MB.' : 'Não foi possível enviar o arquivo.')
    }
    setEnviando(false)
    if (entrada.current) entrada.current.value = ''
  }

  async function remover(a: Anexo) {
    if (!window.confirm(`Excluir o anexo "${a.nome}"?`)) return
    try { await excluirAnexo(a); setAnexos(x => x.filter(y => y.id !== a.id)) }
    catch { setErro('Não foi possível excluir o anexo.') }
  }

  const itens = [
    ...anexos.map(a => ({ chave: a.id, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, link: links.get(a.caminho), remover: () => remover(a) })),
    ...pendentes.map((f, i) => ({ chave: `p${i}`, nome: f.name, tipo: f.type, tamanho: f.size, link: previas[i] || undefined,
      remover: () => onPendentes(pendentes.filter((_, j) => j !== i)) }))
  ]

  return (
    <div className="anexos">
      {itens.map(it => (
        <div key={it.chave} className="anexo">
          <a className="anexo-abrir" href={it.link} target="_blank" rel="noreferrer"
            onClick={e => { if (!it.link) e.preventDefault() }}>
            {ehImagem(it.tipo) && it.link
              ? <img src={it.link} alt="" />
              : <span className="anexo-icone">{ehImagem(it.tipo) ? <IconPhoto size={22} /> : <IconFileTypePdf size={22} />}</span>}
            <span className="anexo-nome">{it.nome}<small>{tamanhoLegivel(it.tamanho)}{it.chave.startsWith('p') ? ' · será enviado ao salvar' : ''}</small></span>
          </a>
          <button type="button" className="icone-btn" aria-label={`Excluir anexo ${it.nome}`} onClick={it.remover}>
            <IconTrash size={18} color="var(--texto-3)" />
          </button>
        </div>
      ))}

      <input ref={entrada} type="file" accept={TIPOS_ACEITOS} multiple hidden onChange={e => escolher(e.target.files)} />
      <button type="button" className="btn btn-bloco" onClick={() => entrada.current?.click()} disabled={enviando}>
        <IconPaperclip size={18} />{enviando ? 'Enviando…' : 'Anexar foto ou PDF'}
      </button>
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
