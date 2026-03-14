package ai.openclaw.uirebellion.game

import androidx.compose.runtime.Immutable
import kotlin.math.max

@Immutable
data class Vec2(
    val x: Float,
    val y: Float,
)

@Immutable
data class ButtonEnemy(
    val id: Int,
    val position: Vec2,
    val size: Vec2,
    val velocityX: Float,
)

@Immutable
data class SwitchTrap(
    val id: Int,
    val position: Vec2,
    val size: Vec2,
    val checked: Boolean,
)

@Immutable
data class BulletEntity(
    val id: Int,
    val position: Vec2,
    val size: Vec2,
    val velocityY: Float,
)

@Immutable
data class TurretEntity(
    val position: Vec2,
    val size: Vec2,
)

@Immutable
data class GameUiState(
    val worldWidth: Float = 360f,
    val worldHeight: Float = 640f,
    val score: Int = 0,
    val sliderValue: Float = 0.5f,
    val turret: TurretEntity = TurretEntity(
        position = Vec2(150f, 580f),
        size = Vec2(56f, 56f),
    ),
    val enemies: List<ButtonEnemy> = emptyList(),
    val traps: List<SwitchTrap> = emptyList(),
    val bullets: List<BulletEntity> = emptyList(),
    val isRunning: Boolean = true,
    val elapsedSeconds: Float = 0f,
) {
    val bestEffortHudText: String
        get() = "Score: $score    Time: ${elapsedSeconds.toInt()}s    Bullets: ${bullets.size}"
}

internal fun rectsOverlap(aPos: Vec2, aSize: Vec2, bPos: Vec2, bSize: Vec2): Boolean {
    val ax2 = aPos.x + aSize.x
    val ay2 = aPos.y + aSize.y
    val bx2 = bPos.x + bSize.x
    val by2 = bPos.y + bSize.y
    return aPos.x < bx2 && ax2 > bPos.x && aPos.y < by2 && ay2 > bPos.y
}

internal fun sliderToTurretX(sliderValue: Float, worldWidth: Float, turretWidth: Float): Float {
    val clamped = sliderValue.coerceIn(0f, 1f)
    return clamped * max(0f, worldWidth - turretWidth)
}
