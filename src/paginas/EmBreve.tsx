import { IconTools } from '@tabler/icons-react'
import Topo from '../componentes/Topo'

/** Tela provisória para o que ainda será construído. */
export default function EmBreve({ titulo, quando }: { titulo: string; quando: string }) {
  return (
    <>
      <Topo titulo={titulo} />
      <div className="pagina">
        <section className="cartao vazio">
          <IconTools size={32} />
          <strong>{titulo}</strong>
          <span>Esta tela chega {quando}.</span>
        </section>
      </div>
    </>
  )
}
