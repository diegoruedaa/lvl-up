import { ITEM_CATALOG, RANK_REWARDS, RANKS, rankForLevel } from 'rules-engine'
import type { ItemId } from 'rules-engine'
import { ITEM_ICONS } from '../../types/database'

interface RankPathProps {
  level: number
}

/** Ilustración propia para los rangos sin objeto de recompensa (Novato, Inmortal), en sustitución
 * del 🏆 de reserva. */
const RANK_FALLBACK_ICONS: Record<string, string> = {
  Novato: '/ilustraciones/novato.png',
  Inmortal: '/ilustraciones/inmortal.png',
}

/** Fracción (0–1) del tramo [fromLevel, toLevel) ya recorrida por `level`, para el relleno
 * parcial del conector entre dos rangos consecutivos — usa los límites reales de RANKS, no un
 * valor inventado. */
function segmentFillFraction(level: number, fromLevel: number, toLevel: number): number {
  const span = toLevel - fromLevel
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (level - fromLevel) / span))
}

/** Camino vertical de "pase de batalla" de los 8 rangos: línea de progreso con relleno parcial
 * dinámico en el tramo actual, indicador circular por rango con el nivel requerido, y el objeto
 * de recompensa como protagonista visual de cada nodo. Compartido por RanksScreen.tsx y
 * DesignSystemPreview.tsx, para que la vista previa sea el mismo componente, no una réplica aparte. */
export function RankPath({ level }: RankPathProps) {
  const currentRank = rankForLevel(level)

  return (
    <ol className="rank-path">
      {RANKS.map((rank, index) => {
        const unlocked = level >= rank.minLevel
        const rewardItemId = RANK_REWARDS[rank.name] as ItemId | null
        const iconSrc = rewardItemId ? ITEM_ICONS[rewardItemId] : RANK_FALLBACK_ICONS[rank.name]
        const rewardLabel = rewardItemId ? ITEM_CATALOG[rewardItemId].displayName : 'Sin recompensa'
        const nextRank = RANKS[index + 1]
        const fillFraction = nextRank ? segmentFillFraction(level, rank.minLevel, nextRank.minLevel) : 0

        return (
          <li
            key={rank.name}
            className="rank-path__item"
            aria-current={rank.name === currentRank.name ? 'step' : undefined}
          >
            <div className="rank-path__line-col">
              <span className={`rank-path__marker${unlocked ? ' rank-path__marker--reached' : ''}`}>
                {rank.minLevel}
              </span>
              {nextRank && (
                <div className="rank-path__connector">
                  <div className="rank-path__connector-fill" style={{ height: `${fillFraction * 100}%` }} />
                </div>
              )}
            </div>

            <div className={`rank-path__content${unlocked ? '' : ' rank-path__content--locked'}`}>
              <span className={`rank-path__frame${unlocked ? ' rank-path__frame--reached' : ' rank-path__frame--locked'}`}>
                {iconSrc ? (
                  <img className="rank-path__frame-img" src={iconSrc} alt="" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">🏆</span>
                )}
              </span>
              <div className="rank-path__text">
                <strong className="rank-path__title">{rank.name}</strong>
                <span className="rank-path__reward">{rewardLabel}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
