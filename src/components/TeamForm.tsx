import { useEffect, useRef, useState } from 'react'
import { Field } from './Field'
import { addTeam, fileToLogo, updateTeam, LOGO_SIZE } from '../teams'
import type { Team } from '../types'

/** Cadastro de time. `team` preenchido = edição; nulo = novo. */
export function TeamForm({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const [name, setName] = useState(team?.name ?? '')
  const [tag, setTag] = useState(team?.tag ?? '')
  const [logo, setLogo] = useState<string | null>(team?.logo ?? null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const errors = {
    name: name.trim() ? null : 'Informe o nome do time.',
    tag: tag.trim() ? null : 'Informe a sigla.',
  }
  const valid = Object.values(errors).every((e) => e === null)

  async function pickLogo(file: File | undefined) {
    if (!file) return
    setLogoError(null)
    try {
      setLogo(await fileToLogo(file))
    } catch (e) {
      setLogoError((e as Error).message)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    const input = { name: name.trim(), tag: tag.trim(), logo }
    if (team) updateTeam(team.id, input)
    else addTeam(input)
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal modal--narrow" onSubmit={submit}>
        <header className="modal__head">
          <h2>{team ? 'Editar time' : 'Novo time'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>

        <div className="modal__body modal__body--single">
          <div className="team-form">
            <div className="team-form__logo">
              <button
                type="button"
                className="logo-drop"
                onClick={() => fileInput.current?.click()}
                title="Escolher imagem"
              >
                {logo ? <img src={logo} alt="" /> : <span>Escolher imagem</span>}
              </button>
              {logo && (
                <button type="button" className="btn btn--small" onClick={() => setLogo(null)}>
                  Remover
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => pickLogo(e.target.files?.[0])}
              />
              <p className="field__hint">reduzida para {LOGO_SIZE}px</p>
              {logoError && <p className="field__error">{logoError}</p>}
            </div>

            <div className="team-form__fields">
              <Field label="Nome" htmlFor="tf-name" error={touched ? errors.name : null}>
                <input
                  id="tf-name"
                  value={name}
                  autoFocus
                  placeholder="Nome completo do time"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              <Field
                label="Sigla"
                htmlFor="tf-tag"
                hint="aparece no cartão do player"
                error={touched ? errors.tag : null}
              >
                <input
                  id="tf-tag"
                  value={tag}
                  maxLength={12}
                  placeholder="Ex.: ZETA"
                  onChange={(e) => setTag(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        <footer className="modal__foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary">
            {team ? 'Salvar' : 'Adicionar'}
          </button>
        </footer>
      </form>
    </div>
  )
}
