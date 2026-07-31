import { MAX_ATTRIBUTE_LEVEL, attributeXpRequiredForLevel } from 'rules-engine'
import { ATTRIBUTE_COLORS, ATTRIBUTE_ICONS, ATTRIBUTE_LABELS, ATTRIBUTES } from '../types/database'
import type { AttributeProgressRow } from '../types/database'
import { AttributeCard } from './ui'

interface AttributesScreenProps {
  attributeProgress: AttributeProgressRow[]
}

export function AttributesScreen({ attributeProgress }: AttributesScreenProps) {
  const byAttribute = new Map(attributeProgress.map((row) => [row.attribute, row]))

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {ATTRIBUTES.map((attribute) => {
        const row = byAttribute.get(attribute)
        if (!row) return null
        const atMaxLevel = row.level >= MAX_ATTRIBUTE_LEVEL

        return (
          <AttributeCard
            key={attribute}
            icon={ATTRIBUTE_ICONS[attribute]}
            label={ATTRIBUTE_LABELS[attribute]}
            color={ATTRIBUTE_COLORS[attribute]}
            level={row.level}
            atMaxLevel={atMaxLevel}
            currentXp={row.current_xp}
            requiredXp={attributeXpRequiredForLevel(row.level)}
          />
        )
      })}
    </ul>
  )
}
