import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  id: string
  rotulo: string
  valor: number
  onChange: (v: number) => void
  /** Mostra o botão +/− para valores negativos (ex.: saldo inicial). */
  permitirNegativo?: boolean
  ajuda?: string
}

/**
 * Campo de dinheiro: a pessoa digita só números e os centavos se ajustam
 * sozinhos (digitar 1 2 3 4 5 mostra 123,45).
 */
export default function CampoValor({ id, rotulo, valor, onChange, permitirNegativo, ajuda }: Props) {
  // O sinal fica guardado à parte para funcionar mesmo com o valor ainda em 0,00.
  const [negativo, setNegativo] = useState(valor < 0)
  useEffect(() => { if (valor !== 0) setNegativo(valor < 0) }, [valor])
  const ref = useRef<HTMLInputElement>(null)
  const texto = fmt.format(Math.abs(valor))

  // Mantém o cursor sempre no fim, como numa calculadora.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement === el) el.setSelectionRange(texto.length, texto.length)
  }, [texto])

  function mudar(e: ChangeEvent<HTMLInputElement>) {
    const digitos = e.target.value.replace(/\D/g, '').slice(0, 12)
    const v = Number(digitos || '0') / 100
    onChange(negativo ? -v : v)
  }

  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="campo-valor">
        {permitirNegativo && (
          <button type="button" className={`sinal ${negativo ? 'neg' : ''}`}
            aria-label={negativo ? 'Valor negativo, tocar para positivo' : 'Valor positivo, tocar para negativo'}
            onClick={() => { setNegativo(n => !n); onChange(-valor) }}>
            {negativo ? '−' : '+'}
          </button>
        )}
        <span className="moeda">R$</span>
        <input id={id} ref={ref} inputMode="numeric" autoComplete="off"
          value={texto} onChange={mudar}
          onFocus={e => { const el = e.target; requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length)) }}
          onClick={e => { const el = e.currentTarget; el.setSelectionRange(el.value.length, el.value.length) }} />
      </div>
      {ajuda && <small className="ajuda">{ajuda}</small>}
    </div>
  )
}
