import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { WinnersEditor } from '../components/WinnersEditor'
import { useData } from '../data'
import { useWinners } from '../winners/store'
import type { GraphicLayout } from '../winners/types'

/** Tela de criação/edição de gráfico. Sem `id` na rota, é um template novo. */
export function WinnersEditorScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { characters } = useData()
  const templates = useWinners()
  const template = id ? (templates.find((t) => t.id === id) ?? null) : null

  if (id && !template) return <p className="empty">Template não encontrado.</p>

  return (
    <WinnersEditor
      characters={characters}
      template={template}
      initialLayout={(params.get('modelo') as GraphicLayout) ?? undefined}
      onClose={() => navigate('/winners')}
    />
  )
}
