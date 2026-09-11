import { useNavigate, useParams } from 'react-router-dom'
import { TopbarEditor } from '../components/TopbarEditor'
import { useData } from '../data'
import { useTopbars } from '../topbar/store'

/** Tela de criação/edição de topbar. Sem `id` na rota, é um template novo. */
export function TopbarEditorScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { characters, flags } = useData()
  const templates = useTopbars()
  const template = id ? (templates.find((t) => t.id === id) ?? null) : null

  if (id && !template) return <p className="empty">Template não encontrado.</p>

  return (
    <TopbarEditor
      characters={characters}
      flags={flags}
      template={template}
      onClose={() => navigate('/topbar')}
    />
  )
}
