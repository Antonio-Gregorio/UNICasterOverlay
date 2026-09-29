import { Slot } from './Slot'
import { autoSides, shouldAutoSplit, towersOf } from './towers'
import { SCENE } from '../overlay/channel'
import { useAutoScroll } from './autoScroll'
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
  alturaUtil,
}: {
  towers: Towers | undefined
  template: BracketTemplate
  people: Person[]
  scale: number
  edit?: BracketEdit
  /**
   * Altura da área da chave, em px de tela, quando a rolagem está ligada. Nulo
   * = sem rolagem: as listas crescem o quanto precisarem, como sempre.
   */
  alturaUtil?: number | null
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

  /*
   * Os nomes dos times numa linha e as listas noutra, e não cada time numa
   * coluna com o nome em cima: é o que deixa só as listas rolarem. Com a
   * rolagem ligada, as listas moram numa janela da altura que sobra depois dos
   * nomes — uma por time, cada uma rolando sozinha. Os nomes ficam parados no
   * topo o tempo todo, e o time que cabe inteiro não se mexe: rolar tudo junto
   * levava para fora da tela quem estava sozinho num time curto.
   */
  const cabeca = slot.height * z
  const vao = slot.gap * z
  const janela = alturaUtil !== null && alturaUtil !== undefined ? Math.max(cabeca, alturaUtil - cabeca - vao) : null

  return (
    <div className="towers">
      <div className="towers__row" style={{ gap: slot.columnGap * z }}>
        {lados.map((_, lado) => (
          <header
            key={lado}
            className="tower__head"
            style={{
              width: slot.width * z,
              height: cabeca,
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
        ))}
      </div>

      <div className="towers__row" style={{ gap: slot.columnGap * z, marginTop: vao }}>
        {lados.map((lista, lado) => (
          <TowerColumn
            key={lado}
            template={template}
            width={slot.width * z}
            gap={vao}
            maxHeight={janela}
            edit={edit}
          >
            {lista.map((s, i) => (
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
          </TowerColumn>
        ))}
      </div>
    </div>
  )
}

/**
 * A lista de um time, na própria janela e com a própria rolagem.
 *
 * Largura fixa, e não a das vagas: um time sem ninguém ainda ocupa a coluna
 * dele, senão as listas desalinhavam dos nomes em cima.
 */
function TowerColumn({
  template,
  width,
  gap,
  maxHeight,
  edit,
  children,
}: {
  template: BracketTemplate
  width: number
  gap: number
  /** Nulo = sem rolagem: a lista cresce o quanto precisar. */
  maxHeight: number | null
  edit?: BracketEdit
  children: React.ReactNode
}) {
  const rolagem = useAutoScroll(template.scroll, { ativo: maxHeight !== null, origem: 'topo' })
  return (
    <div
      className="towers__window"
      ref={rolagem.body}
      style={{ width, maxHeight: maxHeight ?? undefined }}
      // No painel, o mouse em cima pausa: mexer numa vaga que está andando é
      // errar o clique.
      onMouseEnter={edit ? rolagem.pause : undefined}
      onMouseLeave={edit ? rolagem.resume : undefined}
    >
      <div className="tower__list" ref={rolagem.content} style={{ gap }}>
        {children}
      </div>
    </div>
  )
}
