import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  attributeXpRequiredForLevel,
  coinsForBossVictory,
  damageForBossDefeat,
  ITEM_CATALOG,
  MAX_HP,
  xpForMissionCompletion,
  xpRequiredForLevel,
} from 'rules-engine'
import type { Attribute, BossType, Difficulty, MissionCompletionResult } from 'rules-engine'
import { getErrorMessage } from '../lib/errors'
import { claimTutorialReward } from '../lib/gameApi'
import type { ClaimTutorialRewardOutcome } from '../lib/gameApi'
import {
  ATTRIBUTE_COLORS,
  ATTRIBUTE_ICONS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_RIBBON_TEXT,
  ATTRIBUTES,
  BOSS_DIFFICULTY_LABELS,
  bossIllustration,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_STAR_COUNT,
  ITEM_ICONS,
  ITEM_IDS,
  MISSION_DIFFICULTIES,
  playerIllustration,
  RARITY_COLORS,
} from '../types/database'
import type { AttributeProgressRow, CharacterRow, InventoryItemRow, PlayerCharacter } from '../types/database'
import { BattleHex, BossMissionCard, Button, DefeatedFace, ItemRow, MentorDialogueBox, PersonSilhouette, ProgressBar, StarPicker } from './ui'

/**
 * Boss ficticio del tutorial (pasos 12-13): uno de los 6 Boss reales del juego (nombre de ejemplo
 * del documento funcional 7.4 + ilustración real de bossIllustration por atributo, boss_minor para
 * mantener la dificultad más simple), no un nombre inventado sin arte propio. Datos fijos, nunca
 * persistidos — no existe fila `mission` real detrás. La fecha de resultado se calcula una vez al
 * cargar el módulo, solo para que `BossMissionCard` tenga algo plausible que mostrar; no participa
 * en ninguna lógica de "batallas pendientes" real (esa vive en Dashboard.tsx sobre misiones reales).
 */
const TUTORIAL_BOSS_TYPE: BossType = 'boss_minor'
const TUTORIAL_BOSS_ATTRIBUTE: Attribute = 'intellect'
const TUTORIAL_BOSS_NAME = 'Aprobar un examen'
const TUTORIAL_BOSS_DESCRIPTION = 'Un reto grande que ya sabes que se acerca.'
const TUTORIAL_BOSS_RESULT_DATE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

interface TutorialOverlayProps {
  character: CharacterRow
  attributeProgress: AttributeProgressRow[]
  inventory: InventoryItemRow[]
  adventureRunId: string
  /** Personaje elegido por la cuenta (backend/022_player_character.sql), para pintar el lado "Tú" de
   * la arena simulada del paso 13 con la misma ilustración real que usa BossBattleScreen.tsx; null si
   * aún no ha elegido, en cuyo caso se mantiene el BattleHex/PersonSilhouette genérico de siempre. */
  playerCharacter: PlayerCharacter | null
  /** true si tutorial_reward_claimed ya era true al abrir: modo "solo consulta", sin botón de reclamar en el paso 14 (documento 6.2). */
  alreadyClaimed: boolean
  onRewardClaimed: (outcome: ClaimTutorialRewardOutcome) => void
  onClose: () => void
}

const TOTAL_STEPS = 14

interface TutorialStep {
  title: string
  /** Texto explicativo del paso, mostrado en el cuadro de diálogo del mentor (contenido igual al de antes). */
  dialogue: ReactNode
  /** Vista previa en vivo del control correspondiente (sobre datos reales del personaje), con el mismo estilo ya aprobado en el resto de la app; null si el paso no tiene control propio. */
  widget: ReactNode | null
}

export function TutorialOverlay({
  character,
  attributeProgress,
  inventory,
  adventureRunId,
  playerCharacter,
  alreadyClaimed,
  onRewardClaimed,
  onClose,
}: TutorialOverlayProps) {
  const [step, setStep] = useState(1)
  const [testName, setTestName] = useState('Beber un vaso de agua')
  const [testDifficulty, setTestDifficulty] = useState<Difficulty>('easy')
  const [testAttribute, setTestAttribute] = useState<Attribute>('vitality')
  const [testCompleted, setTestCompleted] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bossOutcomePreview, setBossOutcomePreview] = useState<'victory' | 'defeat' | null>(null)

  const primaryAttributeProgress = attributeProgress.find((row) => row.attribute === testAttribute) ?? null

  /**
   * Vista previa pura (rules-engine), nunca persistida: "completar" la
   * misión de prueba del tutorial no debe causar daño real ni dar XP real
   * (documento 6.2), así que solo calculamos sobre el estado actual real qué
   * pasaría, sin escribir nada en character/attribute_progress.
   */
  const preview: MissionCompletionResult | null =
    testCompleted && primaryAttributeProgress
      ? xpForMissionCompletion({
          difficulty: testDifficulty,
          primaryAttribute: testAttribute,
          secondaryAttribute: null,
          generalState: { level: character.level, currentXp: character.current_xp },
          primaryAttributeState: { level: primaryAttributeProgress.level, currentXp: primaryAttributeProgress.current_xp },
          secondaryAttributeState: null,
        })
      : null

  /** Fila real de attribute_progress del atributo fijo del Boss del tutorial (intelecto), leída solo
   * para el preview de XP de abajo — igual que `primaryAttributeProgress` pero para ese atributo en
   * vez de `testAttribute`, ya que el Boss del paso 12-13 ahora es fijo, no sigue al de los pasos 1-3. */
  const bossAttributeProgress = attributeProgress.find((row) => row.attribute === TUTORIAL_BOSS_ATTRIBUTE) ?? null

  /**
   * Misma idea que `preview` pero para la Victoria del Boss ficticio del paso 13: pura,
   * sobre el atributo/estado real actuales, jamás escrita. No depende de `testCompleted` ni de
   * `bossOutcomePreview` — se calcula siempre que hay atributo principal, igual que `preview`.
   */
  const bossXpPreview: MissionCompletionResult | null = bossAttributeProgress
    ? xpForMissionCompletion({
        difficulty: TUTORIAL_BOSS_TYPE,
        primaryAttribute: TUTORIAL_BOSS_ATTRIBUTE,
        secondaryAttribute: null,
        generalState: { level: character.level, currentXp: character.current_xp },
        primaryAttributeState: { level: bossAttributeProgress.level, currentXp: bossAttributeProgress.current_xp },
        secondaryAttributeState: null,
      })
    : null

  function goNext() {
    setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1))
  }

  async function handleFinish() {
    if (alreadyClaimed) {
      onClose()
      return
    }
    setClaiming(true)
    setError(null)
    try {
      const outcome = await claimTutorialReward(adventureRunId)
      onRewardClaimed(outcome)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setClaiming(false)
    }
  }

  function currentStep(): TutorialStep {
    switch (step) {
      case 1:
        return {
          title: '1. Crea una misión',
          dialogue: (
            <p>
              Las misiones son las tareas y rutinas que te propones. Esta es una <strong>misión de prueba</strong>:
              no cuenta para tus estadísticas ni puede hacerte daño real. Ponle un nombre:
            </p>
          ),
          widget: (
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="field-input"
              style={{ width: '100%' }}
            />
          ),
        }
      case 2:
        return {
          title: '2. Elige su dificultad',
          dialogue: <p>Cuanta más difícil sea una misión, más XP da al completarla (y más daño hace si la fallas).</p>,
          widget: (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <StarPicker
                value={DIFFICULTY_STAR_COUNT[testDifficulty]}
                onChange={(n) => setTestDifficulty(MISSION_DIFFICULTIES[n - 1])}
              />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                {DIFFICULTY_LABELS[testDifficulty]}
              </span>
            </div>
          ),
        }
      case 3:
        return {
          title: '3. Elige su atributo principal',
          dialogue: <p>El atributo principal es el que más progresa al completar la misión.</p>,
          widget: (
            <div className="attribute-picker">
              {ATTRIBUTES.map((attribute) => (
                <button
                  key={attribute}
                  type="button"
                  className={`attribute-chip${testAttribute === attribute ? ' attribute-chip--selected' : ''}`}
                  style={{ '--attr-color': ATTRIBUTE_COLORS[attribute], '--attr-fg': ATTRIBUTE_RIBBON_TEXT[attribute] } as CSSProperties}
                  onClick={() => setTestAttribute(attribute)}
                  aria-pressed={testAttribute === attribute}
                >
                  <img className="attribute-chip__icon" src={ATTRIBUTE_ICONS[attribute]} alt="" aria-hidden="true" />
                  {ATTRIBUTE_LABELS[attribute]}
                </button>
              ))}
            </div>
          ),
        }
      case 4:
        return {
          title: '4. Completa la misión',
          dialogue: (
            <p>
              "{testName}" · {DIFFICULTY_LABELS[testDifficulty]} · {ATTRIBUTE_LABELS[testAttribute]}
            </p>
          ),
          widget: (
            <>
              <Button variant="primary" onClick={() => setTestCompleted(true)} disabled={testCompleted}>
                {testCompleted ? 'Misión completada' : 'Completar misión'}
              </Button>
              {!testCompleted && (
                <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  Complétala para ver qué recompensa da.
                </p>
              )}
            </>
          ),
        }
      case 5:
        return {
          title: '5. Recibe XP',
          dialogue: preview ? (
            <p>
              Al completarla has recibido <strong>{preview.xpGained} XP</strong>, que suman tanto a tu nivel general
              como al de {ATTRIBUTE_LABELS[testAttribute]}.
            </p>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)' }}>Todavía no has completado la misión de prueba.</p>
          ),
          widget: preview ? null : <MissingCompletionPrompt onComplete={() => setTestCompleted(true)} />,
        }
      case 6:
        return {
          title: '6. Barra de nivel',
          dialogue: (
            <p>
              Nivel {character.level} — {character.current_xp} / {xpRequiredForLevel(character.level)} XP
            </p>
          ),
          widget: (
            <>
              <ProgressBar current={character.current_xp} max={xpRequiredForLevel(character.level)} color="var(--color-accent-gold)" />
              {preview && (
                <>
                  <p style={{ margin: '0.75rem 0 0.4rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    Después de esta misión: Nivel {preview.general.level} — {preview.general.currentXp} /{' '}
                    {xpRequiredForLevel(preview.general.level)} XP
                    {preview.general.levelsGained > 0 && ' 🎉 ¡Subida de nivel!'}
                  </p>
                  <ProgressBar
                    current={preview.general.currentXp}
                    max={xpRequiredForLevel(preview.general.level)}
                    color="var(--color-accent-gold)"
                  />
                </>
              )}
            </>
          ),
        }
      case 7:
        return {
          title: '7. Progreso de un atributo',
          dialogue: primaryAttributeProgress ? (
            <p>
              {ATTRIBUTE_LABELS[testAttribute]}: nivel {primaryAttributeProgress.level} —{' '}
              {primaryAttributeProgress.current_xp} / {attributeXpRequiredForLevel(primaryAttributeProgress.level)} XP
            </p>
          ) : null,
          widget: primaryAttributeProgress ? (
            <>
              <ProgressBar
                current={primaryAttributeProgress.current_xp}
                max={attributeXpRequiredForLevel(primaryAttributeProgress.level)}
                color={ATTRIBUTE_COLORS[testAttribute]}
              />
              {preview && (
                <>
                  <p style={{ margin: '0.75rem 0 0.4rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    Después de esta misión: nivel {preview.primaryAttributeResult.level} —{' '}
                    {preview.primaryAttributeResult.currentXp} /{' '}
                    {attributeXpRequiredForLevel(preview.primaryAttributeResult.level)} XP
                  </p>
                  <ProgressBar
                    current={preview.primaryAttributeResult.currentXp}
                    max={attributeXpRequiredForLevel(preview.primaryAttributeResult.level)}
                    color={ATTRIBUTE_COLORS[testAttribute]}
                  />
                </>
              )}
            </>
          ) : null,
        }
      case 8:
        return {
          title: '8. Consulta tus HP',
          dialogue: (
            <p>
              Los HP son tu vida. Fallar una misión o perder contra un Boss los reduce; si llegan a 0, mueres y empiezas
              una partida nueva.
            </p>
          ),
          widget: (
            <>
              <p style={{ margin: '0 0 0.4rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                HP: {character.current_hp} / {MAX_HP}
              </p>
              <ProgressBar
                current={character.current_hp}
                max={MAX_HP}
                color={character.current_hp > 30 ? 'var(--color-accent)' : 'var(--color-danger)'}
              />
            </>
          ),
        }
      case 9:
        return {
          title: '9. Abre la mochila',
          dialogue: <p>Ahí se guardan los objetos que compras en el mercado o que consigues como recompensa.</p>,
          widget:
            inventory.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Todavía no tienes ningún objeto.
              </p>
            ) : (
              <div className="item-list">
                {inventory.map((item) => {
                  const catalogItem = ITEM_CATALOG[item.item_id]
                  return (
                    <ItemRow
                      key={item.id}
                      icon={ITEM_ICONS[item.item_id]}
                      name={catalogItem.displayName}
                      rarityColor={RARITY_COLORS[catalogItem.rarity]}
                      quantity={item.quantity}
                      selected={false}
                      onSelect={() => {}}
                    />
                  )
                })}
              </div>
            ),
        }
      case 10:
        return {
          title: '10. Entra en el mercado',
          dialogue: <p>En el mercado gastas tus monedas en objetos: pociones, escudos y otros que te ayudan a sobrevivir.</p>,
          widget: (
            <div className="item-list">
              {ITEM_IDS.slice(0, 3).map((itemId) => {
                const catalogItem = ITEM_CATALOG[itemId]
                return (
                  <ItemRow
                    key={itemId}
                    icon={ITEM_ICONS[itemId]}
                    name={catalogItem.displayName}
                    rarityColor={RARITY_COLORS[catalogItem.rarity]}
                    selected={false}
                    onSelect={() => {}}
                    rightContent={
                      <>
                        <img className="coin-icon" src="/ilustraciones/moneda.png" alt="" /> {catalogItem.price}
                      </>
                    }
                  />
                )
              })}
            </div>
          ),
        }
      case 11:
        return {
          title: '11. Entiende las monedas',
          dialogue: (
            <p>
              Ganas monedas al subir de nivel y al vencer Bosses. Son escasas: gástalas con cabeza. Tienes actualmente:{' '}
              <strong>{character.coins} monedas</strong>.
            </p>
          ),
          widget: (
            <span className="status-panel__coins">
              <img className="coin-icon" src="/ilustraciones/moneda.png" alt="" /> {character.coins}
            </span>
          ),
        }
      case 12:
        return {
          title: '12. Misiones tipo Boss',
          dialogue: (
            <>
              <p>
                Hay un tercer tipo de misión, distinto de Tarea y Rutina: el <strong>Boss</strong>. No se completa al
                instante — tiene una fecha de resultado futura, y hasta que llega no puedes declarar si lo superaste
                o no.
              </p>
              <p>
                Mientras tanto lo verás así en tu lista. El día de la fecha de resultado pasará a{' '}
                <strong>Batallas pendientes</strong>, donde por fin podrás resolverlo.
              </p>
            </>
          ),
          widget: (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <BossMissionCard
                name={TUTORIAL_BOSS_NAME}
                description={TUTORIAL_BOSS_DESCRIPTION}
                attributeIcon={bossIllustration(TUTORIAL_BOSS_ATTRIBUTE)}
                difficultyLabel={BOSS_DIFFICULTY_LABELS[TUTORIAL_BOSS_TYPE]}
                difficultyColor={DIFFICULTY_COLORS[TUTORIAL_BOSS_TYPE]}
                attributeText={ATTRIBUTE_LABELS[TUTORIAL_BOSS_ATTRIBUTE]}
                resultDate={TUTORIAL_BOSS_RESULT_DATE}
              />
            </ul>
          ),
        }
      case 13:
        return {
          title: '13. La arena: Victoria o Derrota',
          dialogue: (
            <>
              {bossOutcomePreview === null && (
                <p>
                  Cuando llega la fecha de resultado, entras en la pantalla de batalla: <strong>Tú</strong> contra el
                  Boss. Ahí declaras con honestidad si ganaste o perdiste. Prueba los dos botones para ver qué pasa
                  en cada caso — puedes cambiar de uno a otro cuantas veces quieras.
                </p>
              )}
              {bossOutcomePreview === 'victory' && (
                <p>
                  Si declaras <strong>Victoria</strong>, ganas monedas y XP, igual que con cualquier misión — pero un
                  Boss da más monedas que una tarea normal.
                </p>
              )}
              {bossOutcomePreview === 'defeat' && (
                <p>
                  Si declaras <strong>Derrota</strong>, pierdes HP — más que con una misión normal, porque un Boss es
                  un reto mayor.
                </p>
              )}
            </>
          ),
          widget: (
            <div className="boss-arena">
              <span className="boss-arena__badge">Batalla contra Boss</span>

              <div className="boss-arena__combatants">
                <div className="boss-arena__side">
                  <div className="boss-arena__side-visual">
                    {/* Misma lógica que playerHex en BossBattleScreen.tsx: si la cuenta ya eligió
                        personaje (chico/chica), su ilustración real; si no, el BattleHex genérico de
                        siempre. playerCharacter llega por prop desde Dashboard.tsx, ya cargado — no
                        se consulta aquí. */}
                    {playerCharacter ? (
                      <img
                        className="boss-arena__player-image"
                        src={playerIllustration(
                          playerCharacter,
                          bossOutcomePreview === null ? 'neutral' : bossOutcomePreview === 'victory' ? 'victoria' : 'derrota',
                        )}
                        alt=""
                      />
                    ) : (
                      <BattleHex
                        icon={bossOutcomePreview === 'defeat' ? <DefeatedFace /> : <PersonSilhouette />}
                        size={76}
                        fillColor="var(--color-border)"
                        iconColor="var(--color-text)"
                        defeated={bossOutcomePreview === 'defeat'}
                      />
                    )}
                  </div>
                  <span className="boss-arena__side-label">Tú</span>
                </div>
                <span className="boss-arena__vs">VS</span>
                <div className="boss-arena__side">
                  <div className="boss-arena__side-visual">
                    {/* Misma ilustración real que usa BossBattleScreen.tsx (bossIllustration por
                        atributo + variante neutral/victoria/derrota) — no un icono genérico, para
                        que el Boss del tutorial tenga la misma imagen que vería el usuario en una
                        Batalla contra Boss real. */}
                    <img
                      className="boss-arena__boss-image"
                      src={bossIllustration(
                        TUTORIAL_BOSS_ATTRIBUTE,
                        bossOutcomePreview === null ? 'neutral' : bossOutcomePreview === 'victory' ? 'victoria' : 'derrota',
                      )}
                      alt=""
                    />
                  </div>
                  <span className="boss-arena__side-label">Boss</span>
                </div>
              </div>

              <h2 className="boss-arena__name">{TUTORIAL_BOSS_NAME}</h2>
              <span className="boss-arena__difficulty-badge">{BOSS_DIFFICULTY_LABELS[TUTORIAL_BOSS_TYPE]}</span>

              <div className="boss-arena__actions">
                <Button variant="primary" onClick={() => setBossOutcomePreview('victory')}>
                  Ver qué pasa si ganas
                </Button>
                <Button variant="danger" onClick={() => setBossOutcomePreview('defeat')}>
                  Ver qué pasa si pierdes
                </Button>
              </div>

              {bossOutcomePreview === 'victory' && bossXpPreview && (
                <div className="boss-arena__breakdown">
                  <p className="boss-arena__breakdown-line">+{bossXpPreview.xpGained} XP</p>
                  <p className="boss-arena__breakdown-line boss-arena__breakdown-coins">
                    +{coinsForBossVictory(TUTORIAL_BOSS_TYPE)} monedas
                  </p>
                </div>
              )}

              {bossOutcomePreview === 'defeat' && (
                <div className="boss-arena__breakdown">
                  <p className="boss-arena__breakdown-line">-{damageForBossDefeat(false)} HP</p>
                </div>
              )}
            </div>
          ),
        }
      case 14:
        return {
          title: '14. Usa una Poción',
          dialogue: (
            <>
              <p>Las pociones curan HP al instante. Se usan desde la mochila.</p>
              <p>
                {alreadyClaimed
                  ? 'Ya reclamaste la recompensa del tutorial anteriormente.'
                  : 'Al terminar el tutorial recibirás de regalo 1 Poción y 10 monedas para empezar tu aventura.'}
              </p>
            </>
          ),
          widget: error ? <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p> : null,
        }
      default:
        return { title: '', dialogue: null, widget: null }
    }
  }

  const { title, dialogue, widget } = currentStep()

  return (
    <div>
      <div className="tutorial-overlay__header">
        <h2 className="tutorial-overlay__title">Tutorial</h2>
        <button type="button" className="tutorial-overlay__skip" onClick={onClose}>
          Saltar tutorial
        </button>
      </div>

      <div className="tutorial-overlay__progress">
        <ProgressBar current={step} max={TOTAL_STEPS} />
      </div>

      <h3 className="tutorial-overlay__step-title">{title}</h3>

      <MentorDialogueBox>{dialogue}</MentorDialogueBox>

      {widget && <div className="tutorial-overlay__widget">{widget}</div>}

      <div className="tutorial-overlay__nav">
        <Button variant="secondary" onClick={goBack} disabled={step === 1}>
          Atrás
        </Button>
        <span className="tutorial-overlay__step-indicator">
          Paso {step} / {TOTAL_STEPS}
        </span>
        {step < TOTAL_STEPS ? (
          <Button variant="primary" onClick={goNext}>
            Siguiente
          </Button>
        ) : (
          <Button variant="primary" onClick={handleFinish} disabled={claiming}>
            {alreadyClaimed ? 'Cerrar' : claiming ? 'Reclamando...' : 'Finalizar tutorial'}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Paso 5 llegado directamente sin pasar por el 4 (p.ej. tras "Atrás" y "Siguiente" saltando pasos): permite completar la misión de prueba ahí mismo en vez de obligar a volver atrás. */
function MissingCompletionPrompt({ onComplete }: { onComplete: () => void }) {
  return (
    <Button variant="primary" onClick={onComplete}>
      Completar misión de prueba ahora
    </Button>
  )
}
