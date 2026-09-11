import { Slot } from './Slot'
import { autoSides, shouldAutoSplit, towersOf } from './towers'
import type { BracketEdit, BracketTemplate, Person, Towers } from './types'

/**
 * O modo de times: duas torres, uma por lado.
 *
 * Não é uma chave — não há confronto nem rodada. É como uma guerra de times se
 * acompanha na transmissão: as duas escalações lado a lado, quem já caiu em
 * cinza, e o placar de cada time em cima. Quem apaga e quem soma ponto é o
 * organizador, pela prévia do painel.
 */
export function TowersView({
  towers,
  template,
  people,
  scale,
  edit,
}: {
  towers: Towers | undefined
  template: BracketTemplate
  people: Person[]
  scale: number
  edit?: BracketEdit
}) {
  const t = towersOf(towers)
  const { slot } = template

  /*
   * Enquanto ninguém escalou, o elenco entra dividido ao meio: uma tela de times
   * que estreia com duas colunas vazias não é "ainda não escalaram", é uma peça
   * quebrada no meio da transmissão. Depois do primeiro gesto vale o que está
   * gravado — inclusive nenhum, se foi isso que pediram.
   */
  const lados = shouldAutoSplit(towers) ? autoSides(people.length) : t.sides

  return (
    <div className="towers" style={{ gap: slot.columnGap * scale }}>
      {([0, 1] as const).map((lado) => (
        <div className="tower" key={lado}>
          <header
            className="tower__head"
            style={{
              width: slot.width * scale,
              height: slot.height * scale,
              borderRadius: slot.radius * scale,
              background: slot.background,
              borderColor: slot.borderColor,
              // A barra do cabeçalho é a cor que o template deu a este lado; a das
              // vagas continua sendo a do personagem de cada um.
              ['--cor' as string]: template.teams[lado].color,
              // Acesa sempre: a cor do time é identidade, não realce de estado.
              ['--brilho' as string]: 1,
              ['--pad' as string]: `${Math.max(2, slot.height * 0.14 * scale)}px`,
            }}
          >
            <span className="bracket__bar" aria-hidden="true" />
            {/* Só o nome: o placar é de cada jogador, na vaga dele. */}
            <strong
              className="tower__name"
              style={{
                color: template.teams[lado].textColor,
                fontSize: slot.height * 0.34 * scale,
              }}
            >
              {t.names[lado]}
            </strong>
          </header>

          <div className="tower__list" style={{ gap: slot.gap * scale, marginTop: slot.gap * scale }}>
            {lados[lado].map((s, i) => (
              <Slot
                key={i}
                person={people[s.entry] ?? null}
                score={s.score}
                template={template}
                scale={scale}
                lost={s.dim}
                won={false}
                edit={edit}
                slotRef={{ kind: 'tower', side: lado, index: i }}
                /* Aqui tirar não perde ninguém: a pessoa continua na lista de
                   participantes, e volta para a torre por um clique. */
                canRemove
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
