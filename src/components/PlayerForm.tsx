import { useEffect, useMemo, useState } from 'react'
import { Select } from './Select'
import { Field } from './Field'
import { Flag } from '../Flag'
import { TeamLogo } from '../TeamLogo'
import { countryFlag, countryOfRegion, regionFlag } from '../flags'
import { countryOptions, EmptyFlag, regionOptions } from '../flagOptions'
import { addPlayer, updatePlayer } from '../players'
import { useTeams } from '../teams'
import type { Character, FlagManifest, Player, Team } from '../types'

/** Valor do seletor de time que revela o campo de texto livre. */
const CUSTOM = '__custom'

/** Cadastro de player. `player` preenchido = edição; nulo = novo. */
export function PlayerForm({
  characters,
  flags,
  player,
  onClose,
}: {
  characters: Character[]
  flags: FlagManifest
  player: Player | null
  onClose: () => void
}) {
  const teams = useTeams()
  const [name, setName] = useState(player?.name ?? '')
  const [characterSlug, setCharacterSlug] = useState<string | null>(player?.characterSlug ?? null)
  const [countryCode, setCountryCode] = useState<string | null>(player?.countryCode ?? null)
  const [regionCode, setRegionCode] = useState<string | null>(player?.regionCode ?? null)
  const [touched, setTouched] = useState(false)

  // O time é ou um cadastrado (com logo) ou um nome digitado. O seletor guarda
  // qual dos dois, e o texto livre fica de lado para não se perder ao alternar.
  const [teamChoice, setTeamChoice] = useState<string | null>(
    player?.teamId ? player.teamId : player?.team ? CUSTOM : null
  )
  const [teamText, setTeamText] = useState(player?.team ?? '')
  const [twitter, setTwitter] = useState(player?.twitter ?? '')

  /**
   * País cujos estados o seletor lista. Anda junto com o campo país, mas
   * sobrevive a "Nenhum país" — é o que permite manter São Paulo selecionado
   * enquanto se esconde a bandeira do Brasil.
   */
  const [scope, setScope] = useState<string | null>(
    player?.countryCode ?? (player?.regionCode ? countryOfRegion(player.regionCode) : null)
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const countries = useMemo(() => countryOptions(flags), [flags])
  const regions = useMemo(() => regionOptions(flags, scope), [flags, scope])
  const characterChoices = useMemo(
    () =>
      characters.map((c) => ({
        value: c.slug,
        label: c.name,
        keywords: `${c.slug} ${c.profile.ability ?? ''}`,
        hint: c.profile.ability ?? undefined,
      })),
    [characters]
  )
  const teamChoices = useMemo(
    () => [
      ...teams.map((t) => ({
        value: t.id,
        label: t.name,
        group: 'Times cadastrados',
        keywords: t.tag,
        hint: t.tag,
        icon: <TeamLogo logo={t.logo} label={t.tag || t.name} />,
      })),
      { value: CUSTOM, label: 'Outro (digitar)' },
    ],
    [teams]
  )

  const scopeName = scope ? (flags.countries.items.find((c) => c.code === scope)?.name ?? scope) : null

  const errors = {
    name: name.trim() ? null : 'Informe o nome do player.',
    characterSlug: characterSlug ? null : 'Escolha o personagem.',
  }
  const valid = Object.values(errors).every((e) => e === null)

  function pickCountry(code: string | null) {
    setCountryCode(code)
    if (!code) return // "Nenhum país": mantém o estado e o escopo atuais
    setScope(code)
    // Trocar de país invalida a região anterior — senão sobra um "BR-SP" num
    // player do Chile.
    if (regionCode && countryOfRegion(regionCode) !== code) setRegionCode(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid || !characterSlug) return

    const input = {
      name: name.trim(),
      characterSlug,
      teamId: teamChoice && teamChoice !== CUSTOM ? teamChoice : null,
      team: teamChoice === CUSTOM ? teamText.trim() || null : null,
      countryCode,
      regionCode,
      // Guarda sem o arroba: quem desenha decide como mostrar.
      twitter: twitter.trim().replace(/^@/, '') || null,
    }
    if (player) updatePlayer(player.id, input)
    else addPlayer(input)
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <header className="modal__head">
          <h2>{player ? 'Editar player' : 'Novo player'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>

        <div className="modal__body">
          <div className="modal__fields">
            <Field label="Nome" htmlFor="pf-name" error={touched ? errors.name : null}>
              <input
                id="pf-name"
                value={name}
                autoFocus
                placeholder="Como aparece no bracket"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field label="Personagem" htmlFor="pf-char" error={touched ? errors.characterSlug : null}>
              <Select
                id="pf-char"
                options={characterChoices}
                value={characterSlug}
                onChange={setCharacterSlug}
                placeholder="Selecione o personagem"
                searchPlaceholder="Buscar personagem..."
              />
            </Field>

            <Field
              label="Time"
              htmlFor="pf-team"
              hint={teams.length ? 'opcional' : 'opcional · nenhum time cadastrado ainda'}
            >
              <Select
                id="pf-team"
                options={teamChoices}
                value={teamChoice}
                onChange={setTeamChoice}
                placeholder="Sem time"
                emptyLabel="Sem time"
                searchPlaceholder="Buscar time..."
              />
            </Field>

            {teamChoice === CUSTOM && (
              <Field label="Nome do time" htmlFor="pf-team-text" hint="não fica salvo no cadastro de times">
                <input
                  id="pf-team-text"
                  value={teamText}
                  placeholder="Sigla ou nome"
                  onChange={(e) => setTeamText(e.target.value)}
                />
              </Field>
            )}

            <Field label="X (Twitter)" htmlFor="pf-twitter" hint="opcional">
              <input
                id="pf-twitter"
                value={twitter}
                placeholder="@seuarroba"
                onChange={(e) => setTwitter(e.target.value)}
              />
            </Field>

            <Field label="País" htmlFor="pf-country" hint="opcional">
              <Select
                id="pf-country"
                options={countries}
                value={countryCode}
                onChange={pickCountry}
                placeholder="Selecione o país"
                emptyLabel="Nenhum país"
                emptyIcon={<EmptyFlag />}
                searchPlaceholder="Buscar país..."
              />
            </Field>

            <Field
              label="Estado"
              htmlFor="pf-region"
              hint={
                !scope
                  ? 'escolha um país para listar'
                  : regions.length === 0
                    ? `${scopeName} não tem bandeiras de estado`
                    : !countryCode
                      ? `estados: ${scopeName}`
                      : 'opcional'
              }
            >
              <Select
                id="pf-region"
                options={regions}
                value={regionCode}
                onChange={setRegionCode}
                disabled={regions.length === 0}
                placeholder="Selecione o estado"
                emptyLabel="Nenhum estado"
                emptyIcon={<EmptyFlag />}
                searchPlaceholder="Buscar estado..."
              />
            </Field>
          </div>

          <Preview
            characters={characters}
            flags={flags}
            name={name}
            team={resolveTeam(teamChoice, teamText, teams)}
            characterSlug={characterSlug}
            countryCode={countryCode}
            regionCode={regionCode}
          />
        </div>

        <footer className="modal__foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary">
            {player ? 'Salvar' : 'Adicionar'}
          </button>
        </footer>
      </form>
    </div>
  )
}

function resolveTeam(
  choice: string | null,
  text: string,
  teams: Team[]
): { label: string; logo: string | null } | null {
  if (choice === CUSTOM) return text.trim() ? { label: text.trim(), logo: null } : null
  const team = teams.find((t) => t.id === choice)
  return team ? { label: team.tag || team.name, logo: team.logo } : null
}

/** Mostra o cartão como ele vai ficar na listagem — inclusive sem bandeira. */
function Preview({
  characters,
  flags,
  name,
  team,
  characterSlug,
  countryCode,
  regionCode,
}: {
  characters: Character[]
  flags: FlagManifest
  name: string
  team: { label: string; logo: string | null } | null
  characterSlug: string | null
  countryCode: string | null
  regionCode: string | null
}) {
  const character = characters.find((c) => c.slug === characterSlug)
  const country = countryFlag(flags, countryCode)
  const region = regionFlag(flags, regionCode)
  const [primary, secondary] = character?.colors ?? []

  return (
    <aside
      className="preview"
      style={
        {
          '--primary': primary?.hex ?? '#4a4a58',
          '--secondary': secondary?.hex ?? '#3a3a48',
        } as React.CSSProperties
      }
    >
      <p className="preview__title">Prévia</p>
      <div className="preview__card">
        {character?.assets.art ? (
          <img src={character.assets.art} alt="" />
        ) : (
          <div className="preview__placeholder">Escolha um personagem</div>
        )}
        <h3>
          {team && <span className="team">{team.label}</span>}
          {name.trim() || 'Nome do player'}
        </h3>
        <p className="muted">{character?.name ?? '—'}</p>
        <div className="player__flags">
          {team?.logo && <TeamLogo logo={team.logo} label={team.label} />}
          {country && <Flag spec={country} />}
          {region && <Flag spec={region} />}
          {!country && !region && !team?.logo && <span className="muted">sem bandeira</span>}
        </div>
      </div>
    </aside>
  )
}
