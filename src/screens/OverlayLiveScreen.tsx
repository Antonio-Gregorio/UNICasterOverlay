import { useCallback, useEffect, useState } from 'react'
import { OverlayStage } from '../overlay/OverlayStage'
import { AnimStage, SCENE } from '../anim/AnimStage'
import { BracketStage } from '../bracket/BracketStage'
import { listen, type OverlayPayload } from '../overlay/channel'

/**
 * A página que o OBS carrega. Só as barras e a apresentação, sobre fundo
 * transparente.
 *
 * Não fala com servidor nenhum: o estado chega pelo evento do obs-browser, por
 * BroadcastChannel ou pelo hash da URL — ver src/overlay/channel.ts. É por isso
 * que ela funciona igual servida pelo `npm run dev`, por um host estático ou
 * pela pasta `dist/` publicada em qualquer lugar.
 */
export function OverlayLiveScreen() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null)
  /** Último disparo que já terminou — ver `tocando`. */
  const [terminado, setTerminado] = useState<string | null>(null)

  useEffect(() => listen(setPayload), [])

  useEffect(() => {
    // O OBS compõe sobre a cena; a cor do painel não pode vazar para cá.
    document.body.classList.add('is-overlay')
    return () => document.body.classList.remove('is-overlay')
  }, [])

  /**
   * A animação toca enquanto o `runId` que chegou não for o que já acabou.
   *
   * O painel manda o payload inteiro a cada mexida — mudar um ponto no placar
   * reenvia a apresentação junto. Guardar qual disparo terminou é o que impede
   * que ela recomece do zero a cada ponto, e dispensa o painel de voltar depois
   * só para limpá-la.
   */
  const anim = payload?.anim ?? null
  const tocando = anim && anim.runId !== terminado ? anim : null
  const aoFim = useCallback(() => setTerminado(anim?.runId ?? null), [anim?.runId])

  const escala = useViewportScale()

  if (!payload) {
    return <div className="overlay-live overlay-live--empty">Aguardando o painel...</div>
  }

  return (
    <div className="overlay-live">
      {/*
       * As barras são posicionadas na cena, e não deixadas no canto: centradas
       * na horizontal e a `offsetY` px do topo. Antes elas caíam no canto
       * superior esquerdo com uma folga fixa, e acertar o lugar exigia arrastar
       * a fonte dentro do OBS — o que muda a escala junto e desalinha o resto.
       */}
      <div
        className="overlay-live__bars"
        style={{ paddingTop: (payload.offsetY ?? 0) * escala }}
      >
        <OverlayStage payload={payload} scale={escala} />
      </div>

      {/*
       * Sempre montado, mesmo sem chave nenhuma: quando o painel tira a chave do
       * ar, é o BracketStage que segura o último quadro enquanto a saída toca.
       * Desmontar aqui cortaria a animação no primeiro quadro dela.
       */}
      <div className="overlay-live__bracket">
        <BracketStage
          play={payload.bracket}
          run={payload.bracketRun ?? 'x'}
          phase={payload.bracketPhase ?? 'in'}
          scale={escala}
          zoom={payload.bracketZoom ?? 1}
          offsetY={payload.bracketOffsetY ?? 0}
        />
      </div>

      {tocando && (
        <div className="overlay-live__anim">
          <AnimStage key={tocando.runId} play={tocando} scale={escala} onDone={aoFim} />
        </div>
      )}
    </div>
  )
}

/**
 * Escala que faz a cena de 1920x1080 caber na fonte, seja qual for o tamanho
 * dela.
 *
 * A documentação pede 1920x1080 e aí a conta dá 1. Mas fonte com o tamanho
 * trocado é o erro mais comum de montar cena, e nele a apresentação sairia
 * cortada — o que não se percebe olhando o painel, só no ar.
 */
function useViewportScale() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const medir = () =>
      setScale(Math.min(window.innerWidth / SCENE.width, window.innerHeight / SCENE.height))
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  return scale
}
