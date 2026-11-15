/** Foto do usuário em círculo; sem foto, mostra as iniciais do nome. */
export default function Avatar({ url, nome, tamanho = 44 }: { url: string | null; nome: string; tamanho?: number }) {
  const iniciais = nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '?'
  return (
    <span className="avatar" style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) }}>
      {url ? <img src={url} alt="" /> : iniciais}
    </span>
  )
}
