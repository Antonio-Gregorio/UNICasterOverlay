import { useEffect, useRef, useState } from 'react'
import { Field } from './Field'
import { addEvent, EVENT_LOGO_SIZE, fileToEventLogo, updateEvent } from '../events'
import type { EventLogo } from '../types'

/** Cadastro de logo de evento. `event` preenchido = edição; nulo = novo. */
export function LogoForm({ event, onClose }: { event: EventLogo | null; onClose: () => void }) {
  const [name, setName] = useState(event?.name ?? '')
  const [image, setImage] = useState<string | null>(event?.image ?? null)
  const [size, setSize] = useState({ width: event?.width ?? 0, height: event?.height ?? 0 })
  const [imageError, setImageError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const errors = {
    name: name.trim() ? null : 'Informe o nome do evento.',
    image: image ? null : 'Escolha a imagem da logo.',
  }
  const valid = Object.values(errors).every((e) => e === null)

  async function pickImage(file: File | undefined) {
    if (!file) return
    setImageError(null)
    try {
      const uploaded = await fileToEventLogo(file)
      setImage(uploaded.dataUrl)
      setSize({ width: uploaded.width, height: uploaded.height })
    } catch (e) {
      setImageError((e as Error).message)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid || !image) return
    const input = { name: name.trim(), image, width: size.width, height: size.height }
    if (event) updateEvent(event.id, input)
    else addEvent(input)
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal modal--narrow" onSubmit={submit}>
        <header className="modal__head">
          <h2>{event ? 'Editar logo' : 'Nova logo de evento'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>

        <div className="modal__body modal__body--single">
          <Field label="Nome do evento" htmlFor="lf-name" error={touched ? errors.name : null}>
            <input
              id="lf-name"
              value={name}
              autoFocus
              placeholder="Ex.: UNI Brasil Cup 2026"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field
            label="Logo"
            hint={
              size.width
                ? `${size.width}×${size.height}px`
                : `reduzida para no máximo ${EVENT_LOGO_SIZE}px`
            }
            error={touched ? errors.image : null}
          >
            <button
              type="button"
              className="logo-drop logo-drop--wide"
              onClick={() => fileInput.current?.click()}
              title="Escolher imagem"
            >
              {image ? <img src={image} alt="" /> : <span>Escolher imagem</span>}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
            {image && (
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  setImage(null)
                  setSize({ width: 0, height: 0 })
                }}
              >
                Remover
              </button>
            )}
            {imageError && <p className="field__error">{imageError}</p>}
          </Field>
        </div>

        <footer className="modal__foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary">
            {event ? 'Salvar' : 'Adicionar'}
          </button>
        </footer>
      </form>
    </div>
  )
}
