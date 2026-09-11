import { TopbarPreview } from '../topbar/TopbarPreview'
import { useData } from '../data'
import type { LogoAlign, OverlayPayload } from './channel'

/** Onde a logo encosta na vertical. As barras nunca se movem: só ela. */
const ALIGN: Record<LogoAlign, string> = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
}

/**
 * As duas barras como o OBS vai ver: nada de fundo, nada de moldura.
 *
 * Serve para os dois lados — a prévia no painel e a página que o OBS carrega —
 * porque a única diferença entre elas é a escala. Por isso tudo aqui é
 * multiplicado por `z`: a prévia é o mesmo desenho, e não uma aproximação.
 *
 * As duas escalas se multiplicam e não se confundem. `scale` é a lente de quem
 * está olhando — a prévia encolhida no painel, a fonte do OBS que não é 1920 de
 * largura. `zoom` é decisão de visual, viaja no payload e vale igual nos dois.
 */
export function OverlayStage({ payload, scale = 1 }: { payload: OverlayPayload; scale?: number }) {
  const { characters, flags } = useData()
  if (!payload.template || !flags) return null

  // Ocultar é não desenhar nada: a fonte do OBS continua de pé, pronta para a
  // próxima mexida, e a cena não fica com um retângulo invisível ocupando lugar.
  if (payload.showBars === false) return null

  const z = scale * (payload.zoom ?? 1)
  const width = payload.width * z
  const logo = payload.logo

  return (
    <div className="overlay-stage" style={{ gap: payload.gap * z }}>
      <TopbarPreview
        template={payload.template}
        data={payload.players[0]}
        characters={characters}
        flags={flags}
        width={width}
      />

      {logo && (
        <img
          className="overlay-stage__logo"
          src={logo.image}
          alt=""
          style={{
            height: logo.size * z,
            // Margem em vez de mais um `gap`: assim o respiro da logo é sempre
            // um extra sobre o vão das barras, e mexer num não desfaz o outro.
            marginInline: logo.gap * z,
            // `alignSelf` e não `alignItems` no palco: as barras têm a mesma
            // altura, e alinhar o conjunto por causa da logo mexeria nelas.
            alignSelf: ALIGN[logo.align],
            transform: logo.offsetY ? `translateY(${logo.offsetY * z}px)` : undefined,
          }}
        />
      )}

      <TopbarPreview
        template={payload.template}
        data={payload.players[1]}
        characters={characters}
        flags={flags}
        width={width}
        // A da direita é sempre espelhada: é o que faz as duas se encararem, e
        // não espelhar nunca foi uma escolha de visual — era um bug com botão.
        mirrored
      />
    </div>
  )
}
