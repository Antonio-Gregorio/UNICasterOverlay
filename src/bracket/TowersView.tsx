import { Slot } from './Slot'
import { autoSides, shouldAutoSplit, towersOf } from './towers'
import { SCENE } from '../overlay/channel'
import type { BracketEdit, BracketTemplate, Person, Towers } from './types'

/**
 * O modo de times: uma torre por time, de 2 a 6.
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
  const n = t.sides.length

  /*
   * Enquanto ninguém escalou, o elenco entra dividido ao meio: uma tela de times
   * que estreia com duas colunas vazias não é "ainda não escalaram", é uma peça
   * quebrada no meio da transmissão. Depois do primeiro gesto vale o que está
   * gravado — inclusive nenhum, se foi isso que pediram.
   */
  /** A cor do time na posição; um template antigo pode não ter todas. */
  const estilo = (lado: number) => template.teams[lado] ?? template.teams[lado % template.teams.length]

  const lados = shouldAutoSplit(towers) ? autoSides(people.length, n) : t.sides

  /*
   * Mais de três ou quatro colunas não cabem na cena no tamanho do template —
   * seis de 300px já passam de 1920. Em vez de cortar o time da ponta, todas
   * encolhem juntas até caber na largura útil do quadro. Com dois times nada
   * muda: o encaixe só reduz, nunca aumenta.
   */
  const largura = n * slot.width + (n - 1) * slot.columnGap
  const util = SCENE.width - 2 * (template.background.padding ?? 0)
  const z = scale * Math.min(1, util / largura)

  return (
    <div className="towers" style={{ gap: slot.columnGap * z }}>
      {lados.map((_, lado) => (
        <div className="tower" key={lado}>
          <header
            className="tower__head"
            style={{
              width: slot.width * z,
              height: slot.height * z,
              borderRadius: slot.radius * z,
              background: slot.background,
              borderColor: slot.borderColor,
              // A barra do cabeçalho é a cor que o template deu a este lado; a das
              // vagas continua sendo a do personagem de cada um.
              ['--cor' as string]: estilo(lado).color,
              // Acesa sempre: a cor do time é identidade, não realce de estado.
              ['--brilho' as string]: 1,
              ['--pad' as string]: `${Math.max(2, slot.height * 0.14 * z)}px`,
            }}
          >
            <span className="bracket__bar" aria-hidden="true" />
            {/* Só o nome: o placar é de cada jogador, na vaga dele. */}
            <strong
              className="tower__name"
              style={{
                color: estilo(lado).textColor,
                fontSize: slot.height * 0.34 * z,
              }}
            >
              {t.names[lado]}
            </strong>
          </header>

          <div className="tower__list" style={{ gap: slot.gap * z, marginTop: slot.gap * z }}>
            {lados[lado].map((s, i) => (
              <Slot
                key={i}
                person={people[s.entry] ?? null}
                score={s.score}
                template={template}
                scale={z}
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
