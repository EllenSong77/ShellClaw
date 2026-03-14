package ai.openclaw.uirebellion.game

import androidx.compose.runtime.BroadcastFrameClock
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.absoluteValue

class GameViewModel : ViewModel() {
    private val vmScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val frameClock = BroadcastFrameClock()

    var uiState by mutableStateOf(initialState())
        private set

    private var bulletSeed = 0
    private var framePusherStarted = false

    init {
        startLoop()
    }

    fun onViewportChanged(width: Float, height: Float) {
        if (width <= 0f || height <= 0f) return
        val turretX = sliderToTurretX(uiState.sliderValue, width, uiState.turret.size.x)
        uiState = uiState.copy(
            worldWidth = width,
            worldHeight = height,
            turret = uiState.turret.copy(position = Vec2(turretX, height - 76f)),
        )
    }

    fun onSliderValueChange(value: Float) {
        val nextX = sliderToTurretX(value, uiState.worldWidth, uiState.turret.size.x)
        uiState = uiState.copy(
            sliderValue = value,
            turret = uiState.turret.copy(position = uiState.turret.position.copy(x = nextX)),
        )
    }

    fun onSliderRelease() {
        spawnBullet()
    }

    fun restart() {
        uiState = initialState(worldWidth = uiState.worldWidth, worldHeight = uiState.worldHeight)
    }

    private fun startLoop() {
        if (!framePusherStarted) {
            framePusherStarted = true
            vmScope.launch {
                while (isActive) {
                    frameClock.sendFrame(System.nanoTime())
                }
            }
        }

        vmScope.launch(frameClock) {
            var lastNanos = 0L
            while (isActive) {
                withFrameNanos { now ->
                    if (lastNanos == 0L) {
                        lastNanos = now
                        return@withFrameNanos
                    }
                    val dt = ((now - lastNanos) / 1_000_000_000f).coerceIn(0f, 0.033f)
                    lastNanos = now
                    step(dt)
                }
            }
        }
    }

    private fun step(dt: Float) {
        val current = uiState
        if (!current.isRunning) return

        val movedEnemies = current.enemies.map { enemy ->
            var nextX = enemy.position.x + enemy.velocityX * dt
            var velocity = enemy.velocityX
            if (nextX <= 0f || nextX + enemy.size.x >= current.worldWidth) {
                velocity = -velocity
                nextX = nextX.coerceIn(0f, current.worldWidth - enemy.size.x)
            }
            enemy.copy(position = enemy.position.copy(x = nextX), velocityX = velocity)
        }

        val movedBullets = current.bullets
            .map { bullet ->
                bullet.copy(position = bullet.position.copy(y = bullet.position.y + bullet.velocityY * dt))
            }
            .filter { it.position.y + it.size.y >= 0f }

        var score = current.score
        val consumedBulletIds = mutableSetOf<Int>()
        val destroyedEnemyIds = mutableSetOf<Int>()
        val toggledTrapIds = mutableSetOf<Int>()

        for (bullet in movedBullets) {
            for (enemy in movedEnemies) {
                if (enemy.id in destroyedEnemyIds) continue
                if (rectsOverlap(bullet.position, bullet.size, enemy.position, enemy.size)) {
                    consumedBulletIds += bullet.id
                    destroyedEnemyIds += enemy.id
                    score += 10
                    break
                }
            }
            if (bullet.id in consumedBulletIds) continue
            for (trap in current.traps) {
                if (trap.id in toggledTrapIds || trap.checked) continue
                if (rectsOverlap(bullet.position, bullet.size, trap.position, trap.size)) {
                    consumedBulletIds += bullet.id
                    toggledTrapIds += trap.id
                    score -= 5
                    break
                }
            }
        }

        val nextEnemies = movedEnemies.map { enemy ->
            if (enemy.id in destroyedEnemyIds) {
                enemy.copy(
                    position = enemy.position.copy(x = ((enemy.id * 83f) % (current.worldWidth - enemy.size.x).coerceAtLeast(1f))),
                    velocityX = if (enemy.velocityX.absoluteValue < 40f) 96f else -enemy.velocityX,
                )
            } else enemy
        }

        val nextTraps = current.traps.map { trap ->
            if (trap.id in toggledTrapIds) trap.copy(checked = true) else trap
        }

        val nextBullets = movedBullets.filterNot { it.id in consumedBulletIds }

        uiState = current.copy(
            score = score,
            enemies = nextEnemies,
            traps = nextTraps,
            bullets = nextBullets,
            elapsedSeconds = current.elapsedSeconds + dt,
        )
    }

    private fun spawnBullet() {
        val turret = uiState.turret
        val bullet = BulletEntity(
            id = bulletSeed++,
            position = Vec2(
                x = turret.position.x + turret.size.x / 2f - 10f,
                y = turret.position.y - 18f,
            ),
            size = Vec2(20f, 20f),
            velocityY = -420f,
        )
        uiState = uiState.copy(bullets = uiState.bullets + bullet)
    }

    override fun onCleared() {
        vmScope.cancel()
        super.onCleared()
    }

    private fun initialState(worldWidth: Float = 360f, worldHeight: Float = 640f): GameUiState {
        return GameUiState(
            worldWidth = worldWidth,
            worldHeight = worldHeight,
            enemies = listOf(
                ButtonEnemy(0, Vec2(24f, 48f), Vec2(92f, 40f), 140f),
                ButtonEnemy(1, Vec2(180f, 104f), Vec2(108f, 40f), -120f),
            ),
            traps = listOf(
                SwitchTrap(0, Vec2(72f, 250f), Vec2(72f, 40f), false),
                SwitchTrap(1, Vec2(220f, 320f), Vec2(72f, 40f), false),
                SwitchTrap(2, Vec2(140f, 390f), Vec2(72f, 40f), false),
            ),
            turret = TurretEntity(
                position = Vec2(sliderToTurretX(0.5f, worldWidth, 56f), worldHeight - 76f),
                size = Vec2(56f, 56f),
            ),
        )
    }
}
