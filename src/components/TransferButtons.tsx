import { useEffect, useMemo, useState } from 'react'
import { Checkbox } from './controls'
import { KIND_LABELS, makeBundle, parseBundle, type ImportResult } from '../transfer'

/**
 * Os botões Exportar e Importar de uma tela de cadastro.
 *
 * Exportar escolhe o que vai no pacote e devolve o JSON para copiar ou baixar;
 * importar recebe o JSON colado. O mesmo componente em todas as telas: o que
 * muda é o `kind` e quem grava — ver `onImport`.
 */
export function TransferButtons<T extends { id: string; name: string }>({
  kind,
  items,
  label,
  related,
  prepare,
  onImport,
}: {
  kind: string
  items: T[]
  /** Descrição de um item na lista de escolha, se o nome sozinho não bastar. */
  label?: (item: T) => string
  /** Como cada item sai no JSON — para tirar o que não deve viajar. */
  prepare?: (item: T) => unknown
  /** Cadastros que vão junto, calculados sobre o que foi escolhido. */
  related?: (selected: T[]) => Record<string, unknown[]>
  onImport: (items: T[], related: Record<string, unknown[]>) => ImportResult
}) {
  const [modo, setModo] = useState<'export' | 'import' | null>(null)
  return (
    <>
      <button type="button" className="btn btn--add" onClick={() => setModo('export')} disabled={items.length === 0}>
        Exportar
      </button>
      <button type="button" className="btn btn--add" onClick={() => setModo('import')}>
        Importar
      </button>
      {modo === 'export' && (
        <ExportModal
          kind={kind}
          items={items}
          label={label}
          related={related}
          prepare={prepare}
          onClose={() => setModo(null)}
        />
      )}
      {modo === 'import' && <ImportModal kind={kind} onImport={onImport} onClose={() => setModo(null)} />}
    </>
  )
}

function Modal({
  title,
  onClose,
  children,
  foot,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  foot: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--narrow" role="dialog" aria-label={title}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>
        <div className="modal__body modal__body--single">{children}</div>
        <footer className="modal__foot">{foot}</footer>
      </div>
    </div>
  )
}

function ExportModal<T extends { id: string; name: string }>({
  kind,
  items,
  label,
  related,
  prepare,
  onClose,
}: {
  kind: string
  items: T[]
  label?: (item: T) => string
  related?: (selected: T[]) => Record<string, unknown[]>
  prepare?: (item: T) => unknown
  onClose: () => void
}) {
  // Tudo marcado de saída: o caso comum é levar a lista inteira, e desmarcar
  // três é mais rápido que marcar trinta.
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(items.map((i) => i.id)))
  const [copiado, setCopiado] = useState(false)
  const escolhidos = useMemo(() => items.filter((i) => marcados.has(i.id)), [items, marcados])
  const json = useMemo(
    () =>
      escolhidos.length
        ? makeBundle(kind, prepare ? escolhidos.map(prepare) : escolhidos, related?.(escolhidos))
        : '',
    [kind, escolhidos, related, prepare]
  )
  const todos = marcados.size === items.length

  function alternar(id: string) {
    setCopiado(false)
    setMarcados((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function baixar() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `unicompslide-${kind}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      title={`Exportar ${KIND_LABELS[kind] ?? kind}`}
      onClose={onClose}
      foot={
        <>
          <button type="button" className="btn" onClick={baixar} disabled={!json}>
            Baixar .json
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!json}
            onClick={() => navigator.clipboard?.writeText(json).then(() => setCopiado(true))}
          >
            {copiado ? 'Copiado' : 'Copiar JSON'}
          </button>
        </>
      }
    >
      <div className="transfer__bar">
        <Checkbox
          checked={todos}
          onChange={(v) => {
            setCopiado(false)
            setMarcados(v ? new Set(items.map((i) => i.id)) : new Set())
          }}
        >
          Todos
        </Checkbox>
        <span className="count">
          {escolhidos.length} de {items.length}
        </span>
      </div>
      <ul className="transfer__list">
        {items.map((item) => (
          <li key={item.id}>
            <Checkbox checked={marcados.has(item.id)} onChange={() => alternar(item.id)}>
              {label ? label(item) : item.name || 'Sem nome'}
            </Checkbox>
          </li>
        ))}
      </ul>
      <textarea className="transfer__json" readOnly value={json} rows={6} onFocus={(e) => e.target.select()} />
    </Modal>
  )
}

function ImportModal<T extends { id: string; name: string }>({
  kind,
  onImport,
  onClose,
}: {
  kind: string
  onImport: (items: T[], related: Record<string, unknown[]>) => ImportResult
  onClose: () => void
}) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<ImportResult | null>(null)

  function importar() {
    try {
      const bundle = parseBundle(texto, kind, KIND_LABELS)
      setFeito(onImport(bundle.items as T[], bundle.related ?? {}))
      setErro(null)
      setTexto('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para importar.')
      setFeito(null)
    }
  }

  async function abrirArquivo(file: File | undefined) {
    if (!file) return
    setTexto(await file.text())
    setErro(null)
    setFeito(null)
  }

  return (
    <Modal
      title={`Importar ${KIND_LABELS[kind] ?? kind}`}
      onClose={onClose}
      foot={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {feito ? 'Fechar' : 'Cancelar'}
          </button>
          <button type="button" className="btn btn--primary" onClick={importar} disabled={!texto.trim()}>
            Importar
          </button>
        </>
      }
    >
      <p className="muted">
        Cole o JSON exportado de outra máquina. Itens com o mesmo id dos que já existem aqui são
        atualizados; os outros entram como novos.
      </p>
      <textarea
        className="transfer__json"
        rows={10}
        value={texto}
        autoFocus
        placeholder='{ "app": "unicompslide", ... }'
        onChange={(e) => {
          setTexto(e.target.value)
          setErro(null)
          setFeito(null)
        }}
      />
      <label className="transfer__file">
        ou abrir um arquivo .json
        <input type="file" accept="application/json,.json" onChange={(e) => abrirArquivo(e.target.files?.[0])} />
      </label>
      {erro && <p className="field__error">{erro}</p>}
      {feito && (
        <p className="transfer__ok">
          {feito.added} {feito.added === 1 ? 'novo' : 'novos'}, {feito.updated}{' '}
          {feito.updated === 1 ? 'atualizado' : 'atualizados'}.
        </p>
      )}
    </Modal>
  )
}
