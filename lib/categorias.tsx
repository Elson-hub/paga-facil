import {
  IconToolsKitchen2, IconHome, IconCar, IconHeartbeat, IconSchool, IconMoodSmile, IconShoppingBag,
  IconFileInvoice, IconReceiptTax, IconPaw, IconDots, IconBriefcase, IconDeviceLaptop, IconTrendingUp,
  IconGift, IconReceiptRefund, IconPlane, IconShirt, IconBolt, IconDroplet, IconWifi, IconPhone,
  IconDeviceTv, IconBarbell, IconPill, IconBabyCarriage, IconBeer, IconCoffee, IconGasStation, IconBus,
  IconBook, IconMovie, IconCash, IconPigMoney, IconBuildingStore, IconTool, IconScissors, IconCategory,
  type Icon
} from '@tabler/icons-react'
import { supabase } from './supabase'

export type TipoCategoria = 'receita' | 'despesa'

export interface Categoria {
  id: string
  nome: string
  tipo: TipoCategoria
  icone: string | null
  cor: string | null
  categoria_pai_id: string | null
  ativa: boolean
}

export interface CategoriaComSubs extends Categoria {
  subcategorias: Categoria[]
}

/** Ícones que a pessoa pode escolher (o nome fica gravado no banco). */
export const ICONES: Record<string, Icon> = {
  'tools-kitchen-2': IconToolsKitchen2, 'coffee': IconCoffee, 'beer': IconBeer, 'building-store': IconBuildingStore,
  'home': IconHome, 'bolt': IconBolt, 'droplet': IconDroplet, 'wifi': IconWifi, 'phone': IconPhone,
  'device-tv': IconDeviceTv, 'tool': IconTool, 'car': IconCar, 'gas-station': IconGasStation, 'bus': IconBus,
  'plane': IconPlane, 'heartbeat': IconHeartbeat, 'pill': IconPill, 'barbell': IconBarbell, 'scissors': IconScissors,
  'school': IconSchool, 'book': IconBook, 'baby-carriage': IconBabyCarriage, 'mood-smile': IconMoodSmile,
  'movie': IconMovie, 'shopping-bag': IconShoppingBag, 'shirt': IconShirt, 'file-invoice': IconFileInvoice,
  'receipt-tax': IconReceiptTax, 'paw': IconPaw, 'briefcase': IconBriefcase, 'device-laptop': IconDeviceLaptop,
  'trending-up': IconTrendingUp, 'pig-money': IconPigMoney, 'cash': IconCash, 'gift': IconGift,
  'receipt-refund': IconReceiptRefund, 'dots': IconDots
}

export const CORES = [
  '#E8833A', '#D64545', '#D4537E', '#8E6CD8', '#5B3FD1', '#3B82C4',
  '#2E8BC0', '#2F9E8F', '#1F9D55', '#7A9A3A', '#E5A50A', '#A35C2D', '#5F6B7A', '#888780'
]

/** Ícone da categoria dentro de uma bolinha colorida. */
export function IconeCategoria({ icone, cor, tamanho = 38 }: { icone: string | null; cor: string | null; tamanho?: number }) {
  const Componente = (icone && ICONES[icone]) || IconCategory
  return (
    <span className="bolinha" style={{ background: cor || '#888780', width: tamanho, height: tamanho }}>
      <Componente size={Math.round(tamanho * 0.53)} />
    </span>
  )
}

/** Categorias de um tipo, cada uma com suas subcategorias, em ordem alfabética. */
export async function listarCategorias(tipo: TipoCategoria): Promise<CategoriaComSubs[]> {
  const { data, error } = await supabase.from('categorias')
    .select('id, nome, tipo, icone, cor, categoria_pai_id, ativa')
    .eq('tipo', tipo).order('nome')
  if (error) throw error
  const todas = (data ?? []) as Categoria[]
  const ordenar = (a: Categoria, b: Categoria) => a.nome.localeCompare(b.nome, 'pt-BR')
  return todas.filter(c => !c.categoria_pai_id).sort(ordenar).map(c => ({
    ...c,
    subcategorias: todas.filter(s => s.categoria_pai_id === c.id).sort(ordenar)
  }))
}

/** True se a categoria (ou alguma subcategoria dela) já foi usada em lançamentos. */
export async function categoriaEmUso(ids: string[]): Promise<boolean> {
  const { count } = await supabase.from('lancamentos')
    .select('id', { count: 'exact', head: true }).in('categoria_id', ids)
  return (count ?? 0) > 0
}
