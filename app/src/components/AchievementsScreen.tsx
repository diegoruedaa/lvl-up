import { ACHIEVEMENT_CATALOG } from 'rules-engine'
import type { AchievementCategory } from 'rules-engine'
import { ACHIEVEMENT_CATEGORY_LABELS, ACHIEVEMENT_ICONS } from '../types/database'
import type { AchievementProgressRow } from '../types/database'
import { AchievementRow, ScreenHeader } from './ui'

interface AchievementsScreenProps {
  achievementProgress: AchievementProgressRow[]
  onClose: () => void
}

/** Orden de categorías tal y como aparecen en el documento, sección 14.3-14.11. */
const CATEGORY_ORDER: AchievementCategory[] = [
  'missions',
  'consistency',
  'bosses',
  'level_rank',
  'attributes',
  'survival',
  'items_market',
  'coins',
  'failure_recovery',
]

function formatUnlockedDate(unlockedAt: string): string {
  return new Date(unlockedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function AchievementsScreen({ achievementProgress, onClose }: AchievementsScreenProps) {
  const unlockedByAchievementId = new Map(achievementProgress.map((row) => [row.achievement_id, row]))
  const unlockedCount = achievementProgress.length
  const totalCount = ACHIEVEMENT_CATALOG.length

  return (
    <div>
      <ScreenHeader title="Logros" onBack={onClose} />

      <div
        style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}
      >
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Tu progreso</p>
        <p style={{ margin: '0.25rem 0 0' }}>
          <strong style={{ fontSize: 'var(--text-lg)' }}>
            {unlockedCount}/{totalCount}
          </strong>{' '}
          <span style={{ fontSize: 'var(--text-sm)' }}>logros conseguidos</span>
        </p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const achievements = ACHIEVEMENT_CATALOG.filter((achievement) => achievement.category === category)
        if (achievements.length === 0) return null

        return (
          <div key={category} className="achievement-group">
            <span className="achievement-group__label">{ACHIEVEMENT_CATEGORY_LABELS[category]}</span>
            <ul className="achievement-list">
              {achievements.map((achievement) => {
                const unlocked = unlockedByAchievementId.get(achievement.id)

                return (
                  <AchievementRow
                    key={achievement.id}
                    icon={ACHIEVEMENT_ICONS[achievement.id] ?? '❓'}
                    name={achievement.name}
                    description={achievement.requirementDescription}
                    unlocked={unlocked != null}
                    meta={unlocked ? `Conseguido el ${formatUnlockedDate(unlocked.unlocked_at)}` : undefined}
                  />
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
