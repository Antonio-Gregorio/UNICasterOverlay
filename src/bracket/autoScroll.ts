import { useCallback, useEffect, useRef, useState } from 'react'
import type { BracketTemplate } from './types'

/**
 * Rola a chave que não cabe: parada no topo, desce até o fim, para, sobe.
 *
 * Mede o que sobra — a altura do conteúdo menos a da área visível — e anda
 * exatamente isso, nem um pixel além. Remede sozinho quando o tamanho muda
 * (outra rodada em cena, outro zoom, mais gente), e para quando tudo passa a
 * caber: uma chave pequena com a rolagem ligada fica quieta no centro, como
 * sempre ficou.
 *
 * Pela Web Animations API e não por keyframes de CSS: as paradas são fatias do
 * ciclo que dependem dos dois tempos escolhidos, e a distância depende da
 * medida. Em CSS isso seria uma regra gerada a cada mudança.
 */
export function useAutoScroll(
  config: BracketTemplate['scroll'] | undefined,
  {
    ativo = true,
    origem = 'centro',
  }: {
    /** Desligado por quem chama, mesmo com o template pedindo. */
    ativo?: boolean
    /**
     * Onde o conteúdo alto está parado sem rolagem: centrado na área, vazando
     * metade para cada lado, ou encostado no topo dela.
     */
    origem?: 'centro' | 'topo'
  } = {}
) {
  const body = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const animacao = useRef<Animation | null>(null)

  const ligado = ativo && (config?.enabled ?? false)
  const duracao = Math.max(500, config?.duration ?? 8000)
  const parada = Math.max(0, config?.pause ?? 0)

  useEffect(() => {
    const caixa = body.current
    const el = content.current
    if (!ligado || !caixa || !el || typeof el.animate !== 'function') return

    let sobra = -1
    const montar = () => {
      // offsetHeight ignora transformações: mede o conteúdo, e não onde a
      // própria animação o deixou.
      const agora = Math.max(0, el.offsetHeight - caixa.clientHeight)
      if (Math.abs(agora - sobra) < 1) return
      sobra = agora
      animacao.current?.cancel()
      animacao.current = null
      if (sobra < 2) return

      // Centrado, o conteúdo alto vaza metade para cada lado: o topo à mostra é
      // meia sobra para baixo, o fim é meia sobra para cima. Encostado no topo,
      // ele já começa mostrando o topo e anda a sobra inteira.
      const inicio = origem === 'centro' ? sobra / 2 : 0
      const topo = `translateY(${inicio}px)`
      const fim = `translateY(${inicio - sobra}px)`
      const ciclo = 2 * duracao + 2 * parada
      animacao.current = el.animate(
        [
          { transform: topo, offset: 0 },
          { transform: topo, offset: parada / ciclo, easing: 'ease-in-out' },
          { transform: fim, offset: (parada + duracao) / ciclo },
          { transform: fim, offset: (2 * parada + duracao) / ciclo, easing: 'ease-in-out' },
          { transform: topo, offset: 1 },
        ],
        { duration: ciclo, iterations: Infinity }
      )
    }

    montar()
    const observer = new ResizeObserver(montar)
    observer.observe(caixa)
    observer.observe(el)
    return () => {
      observer.disconnect()
      animacao.current?.cancel()
      animacao.current = null
    }
  }, [ligado, duracao, parada, origem])

  const pause = useCallback(() => animacao.current?.pause(), [])
  const resume = useCallback(() => animacao.current?.play(), [])

  return { body, content, pause, resume }
}

/**
 * A altura da área onde a chave cabe, em px de tela — ou nulo antes da primeira
 * medida.
 */
export function useAlturaUtil(ref: React.RefObject<HTMLElement | null>): number | null {
  const [altura, setAltura] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setAltura(el.clientHeight)
    medir()
    const observer = new ResizeObserver(medir)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return altura
}
