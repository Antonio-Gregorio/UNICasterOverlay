import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const PANEL_MAX_HEIGHT = 320

/**
 * Casca de dropdown: abre um painel ancorado no gatilho, com campo de busca.
 *
 * O painel vai num portal com posição fixa em vez de ficar dentro do campo — o
 * corpo dos modais rola, e um painel posicionado por dentro era recortado pelo
 * rodapé.
 *
 * `children` recebe o texto buscado e uma função para fechar; quem usa decide
 * o que renderizar com isso. É o que permite ter um só comportamento de
 * dropdown em todo o projeto e ainda listar coisas diferentes.
 */
export function Dropdown({
  id,
  disabled,
  trigger,
  searchPlaceholder = 'Buscar...',
  onEnter,
  children,
}: {
  id?: string
  disabled?: boolean
  trigger: React.ReactNode
  searchPlaceholder?: string
  /**
   * Enter no campo de busca. Quem preenche uma lista inteira digita nome,
   * Enter, nome, Enter — abrir o painel e clicar em cada um custa caro.
   * Devolver true fecha o painel.
   */
  onEnter?: (query: string) => boolean
  children: (query: string, close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [box, setBox] = useState<{ left: number; top: number; width: number; drop: 'down' | 'up' } | null>(
    null
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Abre para cima quando não há espaço embaixo, mas só se em cima houver mais.
    const below = window.innerHeight - r.bottom
    const drop = below < PANEL_MAX_HEIGHT && r.top > below ? 'up' : 'down'
    setBox({ left: r.left, top: drop === 'down' ? r.bottom + 4 : r.top - 4, width: r.width, drop })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation() // fecha só o dropdown, não o modal em volta
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    // `true` para pegar o scroll de qualquer contêiner, não só o da janela.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  return (
    <div className="picker">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="picker__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
          setQuery('')
        }}
      >
        {trigger}
        <span className="picker__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open &&
        box &&
        createPortal(
          <div
            ref={panelRef}
            className="picker__panel"
            style={{
              left: box.left,
              width: box.width,
              ...(box.drop === 'down'
                ? { top: box.top, maxHeight: Math.min(PANEL_MAX_HEIGHT, window.innerHeight - box.top - 12) }
                : {
                    bottom: window.innerHeight - box.top,
                    maxHeight: Math.min(PANEL_MAX_HEIGHT, box.top - 12),
                  }),
            }}
          >
            <input
              type="search"
              className="picker__search"
              autoFocus
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !onEnter) return
                e.preventDefault()
                if (onEnter(query.trim())) setOpen(false)
              }}
            />
            <ul className="picker__list" role="listbox">
              {children(query.trim().toLowerCase(), () => setOpen(false))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}
