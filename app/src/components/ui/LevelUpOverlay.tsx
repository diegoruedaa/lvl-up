import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_CHARACTER_LEVEL, RANK_REWARDS, ITEM_CATALOG, rankForLevel, simulateGeneralLevelUpSequence, xpRequiredForLevel } from 'rules-engine'
import { ITEM_ICONS } from '../../types/database'
import type { RankRewardOutcome } from '../../lib/gameApi'

interface LevelUpOverlayProps {
  oldLevel: number
  oldXp: number
  xpGained: number
  /** Recompensas de rango (rules-engine, documento 12.3) ya concedidas por el backend para esta subida, en el mismo orden en que se cruzan los rangos. */
  rankRewards: RankRewardOutcome[]
  /** Se llama una sola vez, tras la espera final, para que Dashboard aplique ya el estado real (que hasta ahora se mantuvo oculto detrás de este overlay). */
  onComplete: () => void
}

const FILL_MS = 900
const DING_HOLD_MS = 650
const RANK_HOLD_MS = 1700
const FINAL_HOLD_MS = 2500

interface BarState {
  current: number
  max: number
  /** true justo al montar cada tramo: la barra "salta" sin transición a su punto de partida antes de animarse hacia el destino. */
  instant: boolean
  complete: boolean
}

interface RankReveal {
  name: string
  iconSrc?: string
  rewardLabel: string | null
}

/**
 * Overlay a pantalla completa que anima, paso a paso (un "ding" por nivel,
 * con parada extra si se cruza de rango), la subida de nivel que
 * simulateGeneralLevelUpSequence ya calculó a partir de la misma XP que
 * applyGeneralXp aplicó de verdad. Es pura presentación: no decide nada del
 * juego, solo reproduce en cámara lenta un resultado ya calculado y avisa a
 * Dashboard (onComplete) cuando puede reflejarlo en el HUD real.
 */
export function LevelUpOverlay({ oldLevel, oldXp, xpGained, rankRewards, onComplete }: LevelUpOverlayProps) {
  const sequence = useMemo(
    () => simulateGeneralLevelUpSequence({ level: oldLevel, currentXp: oldXp }, xpGained),
    [oldLevel, oldXp, xpGained],
  )

  const [displayLevel, setDisplayLevel] = useState(oldLevel)
  const [bar, setBar] = useState<BarState>({
    current: oldXp,
    max: xpRequiredForLevel(oldLevel),
    instant: true,
    complete: false,
  })
  const [popLevel, setPopLevel] = useState(false)
  const [rankReveal, setRankReveal] = useState<RankReveal | null>(null)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const rewardQueueRef = useRef<RankRewardOutcome[]>(rankRewards)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    let cancelled = false

    function wait(ms: number): Promise<void> {
      return new Promise((resolve) => {
        timeoutRef.current = setTimeout(resolve, ms)
      })
    }
    function nextFrame(): Promise<void> {
      return new Promise((resolve) => {
        rafRef.current = requestAnimationFrame(() => resolve())
      })
    }

    async function fillBar(fromXp: number, toXp: number, max: number) {
      setBar({ current: fromXp, max, instant: true, complete: false })
      // Dos rAF (no uno) para asegurar que el navegador pinta el estado "instant" antes de
      // activar la transición; con uno solo, algunos navegadores funden ambos cambios en el
      // mismo frame y la barra salta directa al destino sin animarse.
      await nextFrame()
      await nextFrame()
      if (cancelled) return
      setBar({ current: toXp, max, instant: false, complete: toXp >= max })
      await wait(FILL_MS)
    }

    async function run() {
      for (const step of sequence.steps) {
        if (cancelled) return
        await fillBar(step.startXp, step.xpRequired, step.xpRequired)
        if (cancelled) return

        const newLevel = step.level + 1
        setDisplayLevel(newLevel)
        setPopLevel(true)
        await wait(DING_HOLD_MS)
        if (cancelled) return
        setPopLevel(false)

        const oldRank = rankForLevel(step.level)
        const newRank = rankForLevel(newLevel)
        if (newRank.name !== oldRank.name) {
          const hasReward = RANK_REWARDS[newRank.name] !== null
          const reward = hasReward ? rewardQueueRef.current.shift() : undefined
          setRankReveal({
            name: newRank.name,
            iconSrc: reward ? ITEM_ICONS[reward.itemId] : undefined,
            rewardLabel: reward ? ITEM_CATALOG[reward.itemId].displayName : null,
          })
          await wait(RANK_HOLD_MS)
          if (cancelled) return
          setRankReveal(null)
        }
      }

      if (cancelled) return
      if (sequence.finalLevel < MAX_CHARACTER_LEVEL) {
        await fillBar(0, sequence.finalXp, xpRequiredForLevel(sequence.finalLevel))
      } else {
        setBar({ current: 1, max: 1, instant: true, complete: true })
      }
      if (cancelled) return

      await wait(FINAL_HOLD_MS)
      if (!cancelled) onCompleteRef.current()
    }

    void run()
    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // Solo debe correr una vez por montaje: sequence/onComplete se leen vía ref/useMemo estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence])

  const maxed = sequence.finalLevel >= MAX_CHARACTER_LEVEL && displayLevel === sequence.finalLevel

  return (
    <div className="level-up-overlay" role="alert" aria-live="assertive">
      <div className="level-up-overlay__panel">
        <span className="level-up-overlay__title">¡Subida de nivel!</span>
        <div className="level-up-overlay__level-row">
          <span className={`level-up-overlay__level${popLevel ? ' level-up-overlay__level--pop' : ''}`}>
            {displayLevel}
          </span>
          <span className="level-up-overlay__level-caption">NIVEL</span>
        </div>
        <div className="level-up-overlay__bar-track">
          <div
            className={`level-up-overlay__bar-fill${bar.instant ? ' level-up-overlay__bar-fill--instant' : ''}${
              bar.complete ? ' level-up-overlay__bar-fill--complete' : ''
            }`}
            style={{ width: `${Math.min(100, (bar.current / bar.max) * 100)}%` }}
          />
        </div>
        <span className="level-up-overlay__xp-label">{maxed ? 'NIVEL MÁXIMO' : `${bar.current} / ${bar.max} XP`}</span>
      </div>

      {rankReveal && (
        <div className="level-up-overlay__rank-reveal">
          <span className="level-up-overlay__rank-icon">
            {rankReveal.iconSrc ? (
              <img className="level-up-overlay__rank-icon-img" src={rankReveal.iconSrc} alt="" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">🏆</span>
            )}
          </span>
          <strong className="level-up-overlay__rank-name">¡Rango {rankReveal.name}!</strong>
          {rankReveal.rewardLabel && (
            <span className="level-up-overlay__rank-reward">+1 {rankReveal.rewardLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
