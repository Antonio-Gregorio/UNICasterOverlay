import { useMemo, useState } from 'react'
import { Toolbar } from './Toolbar'
import { FaceCrop } from '../FaceCrop'
import type { Character, ViewMode } from '../types'

export function CharactersTab({ characters }: { characters: Character[] }) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('grid')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return characters
    return characters.filter((c) => c.name.toLowerCase().includes(term))
  }, [characters, query])

  return (
    <>
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${characters.length}`}
      />

      {filtered.length === 0 ? (
        <p className="empty">Nenhum personagem com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--characters' : 'list'}>
          {filtered.map((c) =>
            view === 'grid' ? <CharacterCard key={c.slug} character={c} /> : <CharacterRow key={c.slug} character={c} />
          )}
        </div>
      )}
    </>
  )
}

/** As três cores do personagem viram tokens CSS do cartão. */
function paletteVars(character: Character): React.CSSProperties {
  const [primary, secondary, tertiary] = character.colors ?? []
  return {
    ['--primary' as string]: primary?.hex ?? '#888',
    ['--secondary' as string]: secondary?.hex ?? '#666',
    ['--tertiary' as string]: tertiary?.hex ?? '#444',
  }
}

function Swatches({ character }: { character: Character }) {
  return (
    <div className="swatches">
      {(character.colors ?? []).map((c) => (
        <span key={c.role} style={{ background: c.hex }} title={`${c.role} ${c.hex}`} />
      ))}
    </div>
  )
}

function CharacterCard({ character }: { character: Character }) {
  return (
    <article className="card" style={paletteVars(character)}>
      {character.assets.art && <img src={character.assets.art} alt={character.name} loading="lazy" />}
      <h3>{character.name}</h3>
      <p className="muted">{character.profile.ability}</p>
      <Swatches character={character} />
    </article>
  )
}

function CharacterRow({ character }: { character: Character }) {
  return (
    <article className="row" style={paletteVars(character)}>
      <FaceCrop character={character} />
      <div className="row__main">
        <h3>{character.name}</h3>
        <p className="muted">
          {character.profile.ability}
          {character.profile.weapon && ` · ${character.profile.weapon}`}
        </p>
      </div>
      <Swatches character={character} />
    </article>
  )
}
