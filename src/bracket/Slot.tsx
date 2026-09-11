import { useState } from 'react'
import { Flag } from '../Flag'
import { countryFlag } from '../flags'
import { artSource, faceCover } from '../portrait'
import { useData } from '../data'
import type { BracketEdit, BracketTemplate, Person, SlotRef } from './types'

/** Zoom do recorte de rosto na vaga. Só a cabeça cabe numa faixa de 56px. */
const FACE_ZOOM = 1.6

/**
 * Uma vaga: a casa onde alguém está.
 *
 * Serve a chave e as torres, e nos três modos — o que muda é quem entrega o
 * `person` e o placar. No modo de duplas ela desenha os dois bonecos lado a
 * lado e os dois nomes empilhados, cada um com a sua bandeira: dois nomes na
 * mesma linha caberiam em 90px cada, o que não se lê numa transmissão.
 *
 * Com `edit`, ganha os gestos do painel — ponto, cinza, tirar da casa e
 * arrastar. A fonte do OBS nunca recebe isso: lá a chave é imagem.
 */
export function Slot({
  person,
  score,
  template,
  scale,
  lost,
  won,
  edit,
  slotRef,
  canRemove = false,
}: {
  person: Person | null
  score: number
  template: BracketTemplate
  scale: number
  lost: boolean
  won: boolean
  edit?: BracketEdit
  slotRef?: SlotRef
  canRemove?: boolean
}) {
  const { characters, flags } = useData()
  const { show, slot, highlight, typography } = template
  const [alvo, setAlvo] = useState(false)

  const duo = template.mode === 'duo'
  const daPessoa = (p: Person | null) =>
    highlight.useCharacterColor ? (p?.color ?? highlight.color) : highlight.color
  const cor = daPessoa(person)
  /* No modo de duplas o segundo tem cor própria: é o que faz o anel ir de um
     jogador ao outro em vez de pintar a dupla inteira com a cor de um só. */
  const corB = duo ? daPessoa(person?.partner ?? null) : cor

  /*
   * O anel da vaga, em duplas, é um degradê a -45° da esquerda (o primeiro) para
   * a direita (o segundo).
   *
   * As pontas entram **na ordem inversa** de propósito: em CSS, 0° aponta para
   * cima e o ângulo cresce no sentido horário, então -45° aponta para o
   * topo-esquerdo — a primeira cor da lista é a que fica embaixo à direita. Com
   * a ordem natural, o segundo jogador acabava pintando o lado esquerdo da vaga.
   *
   * Desenhado como borda em degradê — o fundo da vaga recortado em `padding-box`
   * sobre o degradê em `border-box`. Não é `mask`, que o navegador do OBS nem
   * sempre compõe, e não é o brilho do `::after`, que só aceita cor chapada.
   *
   * As pontas já vêm misturadas com a cor da borda na força do realce, que é o
   * mesmo que o caso de um jogador faz por opacidade: assim o slider continua
   * valendo aqui.
   */
  const forca = highlight.enabled ? (won ? 0.35 + (highlight.intensity / 100) * 0.65 : (highlight.intensity / 100) * 0.55) : 0
  const anel = duo
    ? `linear-gradient(${slot.background}, ${slot.background}) padding-box,` +
      ` linear-gradient(-45deg, ${mistura(slot.borderColor, corB, forca)}, ${mistura(slot.borderColor, cor, forca)}) border-box`
    : null

  /*
   * A caixa do rosto é quadrada no confronto e mais estreita na dupla.
   *
   * Dois retratos quadrados comiam 112px de uma vaga de 300, e o que sobrava
   * cortava o nome no terceiro caractere. Estreitar corta as laterais do
   * recorte, não a cabeça — que é o que a régua de rosto já centraliza.
   */
  const larguraArte = slot.height * (duo ? 0.72 : 1)
  const arte = (p: Person | null) => {
    const character = characters.find((c) => c.slug === p?.characterSlug) ?? null
    const source = show.characterArt && character ? artSource(character, false) : null
    const box = { x: 0, y: 0, width: larguraArte, height: slot.height }
    return source ? { source, art: faceCover(source, box, FACE_ZOOM) } : null
  }
  const bandeira = (p: Person | null) =>
    show.countryFlag && flags ? countryFlag(flags, p?.countryCode ?? null) : null

  const a = arte(person)
  const b = duo ? arte(person?.partner ?? null) : null
  const flagA = bandeira(person)
  const flagB = duo ? bandeira(person?.partner ?? null) : null

  const arrastavel = Boolean(edit && slotRef && person)

  return (
    <div
      className={
        `bracket__slot${duo ? ' is-duo' : ''}` +
        `${won ? ' is-winner' : ''}${lost ? ' is-loser' : ''}${person ? '' : ' is-empty'}` +
        `${edit ? ' is-editable' : ''}${alvo ? ' is-drop' : ''}`
      }
      style={{
        height: slot.height * scale,
        width: slot.width * scale,
        borderRadius: slot.radius * scale,
        background: anel ?? slot.background,
        // Com o anel em degradê a borda é o próprio fundo pintado: uma cor aqui
        // taparia o degradê justamente na faixa em que ele aparece.
        borderColor: anel ? 'transparent' : slot.borderColor,
        // O realce é do lado esquerdo, onde a barra de cor encosta na arte.
        ['--cor' as string]: cor,
        ['--brilho' as string]: highlight.enabled ? highlight.intensity / 100 : 0,
        ['--apagar' as string]: template.dimLosers ? template.dimAmount / 100 : 0,
        // O respiro de cada peça, proporcional à vaga — ver .bracket__slot no CSS.
        ['--pad' as string]: `${Math.max(2, slot.height * 0.14 * scale)}px`,
      }}
      draggable={arrastavel}
      onDragStart={(e) => {
        if (!arrastavel) return
        e.dataTransfer.setData('text/plain', JSON.stringify(slotRef))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onDragOver={(e) => {
        if (!edit || !slotRef) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setAlvo(true)
      }}
      onDragLeave={() => setAlvo(false)}
      onDrop={(e) => {
        setAlvo(false)
        if (!edit || !slotRef) return
        e.preventDefault()
        try {
          const de = JSON.parse(e.dataTransfer.getData('text/plain')) as SlotRef
          edit.copy(de, slotRef)
        } catch {
          /* arrasto de fora da chave: não é nosso */
        }
      }}
    >
      <span className="bracket__bar" aria-hidden="true" />

      {show.characterArt && (
        <>
          <Arte peca={a} largura={larguraArte} altura={slot.height} scale={scale} />
          {duo && <Arte peca={b} largura={larguraArte} altura={slot.height} scale={scale} />}
        </>
      )}

      {duo ? (
        <span className="bracket__duo">
          {[
            { p: person, flag: flagA },
            { p: person?.partner ?? null, flag: flagB },
          ].map((linha, i) => (
            <span key={i} className="bracket__duo-line">
              {linha.flag && (
                <Flag spec={linha.flag} height={Math.round(slot.height * 0.2 * scale)} />
              )}
              <span style={{ color: typography.nameColor, fontSize: slot.height * 0.28 * scale }}>
                {linha.p?.name ?? ''}
              </span>
              {/* A sigla do time some sozinha quando não há time, mas não pode
                  sumir por causa do modo: o template liga uma opção só, e ela
                  vale nos três desenhos. */}
              {show.teamTag && linha.p?.teamTag && (
                <em style={{ fontSize: slot.height * 0.2 * scale }}>{linha.p.teamTag}</em>
              )}
            </span>
          ))}
        </span>
      ) : (
        <>
          {flagA && (
            <span className="bracket__flag">
              <Flag spec={flagA} height={Math.round(slot.height * 0.32 * scale)} />
            </span>
          )}
          <span
            className="bracket__name"
            style={{ color: typography.nameColor, fontSize: slot.height * 0.34 * scale }}
          >
            {person?.name ?? ''}
            {show.teamTag && person?.teamTag && (
              <em style={{ fontSize: slot.height * 0.24 * scale }}>{person.teamTag}</em>
            )}
          </span>
        </>
      )}

      {show.score && (
        <strong
          className="bracket__score"
          style={{
            color: typography.scoreColor,
            fontSize: slot.height * 0.42 * scale,
            /*
             * Faixa fixa, larga o bastante para dois dígitos.
             *
             * Sem ela a caixa do placar encolhia com o número: "2" ocupava menos
             * que "10", e o que sobrava ia para o nome ao lado. O resultado era
             * uma coluna que mudava de largura de linha para linha — os nomes
             * truncando em pontos diferentes e os números tortos entre si.
             */
            minWidth: slot.height * 0.72 * scale,
          }}
        >
          {person ? score : ''}
        </strong>
      )}

      {/*
       * O selo de quem passou fica sempre no lugar, aceso só no vencedor.
       * Aparecer e sumir mudaria a largura útil da vaga, e o placar dançaria de
       * linha em linha dentro da mesma coluna conforme os resultados saíssem.
       */}
      {show.winnerMark && (
        <span
          className={`bracket__pass${won ? ' is-on' : ''}`}
          style={{
            width: slot.height * 0.4 * scale,
            height: slot.height * 0.4 * scale,
            // Na dupla, a ponta direita do degradê: o selo fica do lado do
            // segundo jogador e fecha a leitura da cor que corre pela vaga.
            color: duo ? corB : undefined,
          }}
          title={won ? 'Passou para a próxima' : undefined}
          aria-hidden={!won}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 12.5 L9.5 18 L20 6.5"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      {edit && slotRef && <SlotEdit edit={edit} slotRef={slotRef} canRemove={canRemove} dim={lost} />}
    </div>
  )
}

/**
 * Mistura duas cores hex, `t` de 0 (a primeira) a 1 (a segunda).
 *
 * Em JS e não em CSS porque `color-mix()` só existe a partir do Chrome 111 e o
 * navegador embutido do OBS costuma estar atrás — o mesmo motivo que mantém
 * `rgb(from ...)` fora daqui. Cor que ele não entende não degrada: some.
 */
function mistura(a: string, b: string, t: number): string {
  const canal = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) || 0
  const passo = (i: number) => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * Math.min(1, Math.max(0, t)))
  return `#${[0, 1, 2].map((i) => passo(i).toString(16).padStart(2, '0')).join('')}`
}

/**
 * O recorte de rosto dentro da caixa quadrada da vaga.
 *
 * A conta de enquadramento roda em px de cena e só então é escalada: `faceCover`
 * mede sobre a arte original, e escalar antes arrastaria o erro de arredondamento
 * para dentro do recorte.
 */
function Arte({
  peca,
  largura,
  altura,
  scale,
}: {
  peca: { source: { href: string }; art: { x: number; y: number; width: number; height: number } } | null
  largura: number
  altura: number
  scale: number
}) {
  return (
    <span className="bracket__art" style={{ width: largura * scale, height: altura * scale }}>
      {peca && (
        <img
          src={peca.source.href}
          alt=""
          style={{
            left: peca.art.x * scale,
            top: peca.art.y * scale,
            width: peca.art.width * scale,
            height: peca.art.height * scale,
          }}
        />
      )}
    </span>
  )
}

/**
 * Os gestos, ancorados na vaga.
 *
 * Em px fixos, e não multiplicados pela escala: a prévia do painel desenha a
 * cena a 40% e um botão a 40% seria de 9px — pequeno demais para acertar com o
 * mouse. Como o desenho não usa `transform: scale`, um filho em tamanho fixo
 * simplesmente não encolhe junto.
 */
function SlotEdit({
  edit,
  slotRef,
  canRemove,
  dim,
}: {
  edit: BracketEdit
  slotRef: SlotRef
  canRemove: boolean
  dim: boolean
}) {
  const parar = (e: React.MouseEvent) => e.stopPropagation()
  return (
    <span className="bracket-edit" draggable={false} onDragStart={(e) => e.preventDefault()}>
      <button type="button" title="Tirar um ponto" onMouseDown={parar} onClick={() => edit.score(slotRef, -1)}>
        −
      </button>
      <button type="button" title="Somar um ponto" onMouseDown={parar} onClick={() => edit.score(slotRef, 1)}>
        +
      </button>
      <button
        type="button"
        title={dim ? 'Voltar a cor' : 'Deixar em cinza'}
        className={dim ? 'is-on' : ''}
        onMouseDown={parar}
        onClick={() => edit.toggleDim(slotRef)}
      >
        ◐
      </button>
      {canRemove && (
        <button
          type="button"
          title="Tirar da casa"
          onMouseDown={parar}
          onClick={() => edit.remove(slotRef)}
        >
          ✕
        </button>
      )}
    </span>
  )
}
