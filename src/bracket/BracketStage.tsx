import { BracketView } from './BracketView'
import type { BracketEdit, BracketPlay } from './types'

/**
 * A chave em cena.
 *
 * Não guarda estado nenhum: desenha o que o payload manda desenhar. A ponta em
 * que a transição está (`phase`) e o id do disparo (`run`) vêm de quem tem o
 * relógio — o painel —, e é isso que mantém a prévia e a fonte do OBS na mesma
 * página.
 *
 * Antes, a saída era deduzida aqui: `play` virava nulo, este componente segurava
 * o último quadro e rodava um `setTimeout` próprio. Funcionava enquanto nada se
 * perdia no caminho; bastava uma mensagem atrasar, ou a fonte recarregar no meio
 * da transição, para as duas pontas discordarem — e não havia como uma corrigir
 * a outra, porque o estado da animação não estava em lugar nenhum além delas.
 *
 * `key={run}` é o que faz a entrada tocar: remontar reinicia a animação do CSS,
 * e sem trocar de chave ela não recomeça a cada reenvio.
 */
export function BracketStage({
  play,
  run = 'x',
  phase = 'in',
  scale = 1,
  zoom = 1,
  offsetY = 0,
  edit,
}: {
  /** Nulo = fora de cena. A saída chega como `phase: 'out'`, ainda com o play. */
  play: BracketPlay | null
  run?: string
  phase?: 'in' | 'out'
  scale?: number
  zoom?: number
  offsetY?: number
  /** Gestos do painel. A fonte do OBS não passa nada aqui. */
  edit?: BracketEdit
}) {
  if (!play) return null
  return (
    <BracketView
      key={run}
      play={play}
      scale={scale}
      zoom={zoom}
      offsetY={offsetY}
      phase={phase}
      edit={edit}
    />
  )
}
