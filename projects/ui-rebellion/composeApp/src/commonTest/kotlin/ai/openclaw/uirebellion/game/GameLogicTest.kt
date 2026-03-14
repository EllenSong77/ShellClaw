package ai.openclaw.uirebellion.game

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GameLogicTest {
    @Test
    fun slider_to_turret_x_is_clamped() {
        assertEquals(0f, sliderToTurretX(-1f, 360f, 56f))
        assertEquals(304f, sliderToTurretX(2f, 360f, 56f))
        assertEquals(152f, sliderToTurretX(0.5f, 360f, 56f))
    }

    @Test
    fun rect_overlap_detects_collision() {
        assertTrue(
            rectsOverlap(
                aPos = Vec2(0f, 0f),
                aSize = Vec2(20f, 20f),
                bPos = Vec2(10f, 10f),
                bSize = Vec2(20f, 20f),
            )
        )
        assertFalse(
            rectsOverlap(
                aPos = Vec2(0f, 0f),
                aSize = Vec2(20f, 20f),
                bPos = Vec2(30f, 30f),
                bSize = Vec2(20f, 20f),
            )
        )
    }

    @Test
    fun slider_release_spawns_bullet_and_moves_turret() {
        val vm = GameViewModel()
        vm.onViewportChanged(360f, 640f)
        vm.onSliderValueChange(1f)
        assertEquals(304f, vm.uiState.turret.position.x)

        val before = vm.uiState.bullets.size
        vm.onSliderRelease()
        val afterState = vm.uiState

        assertEquals(before + 1, afterState.bullets.size)
        val bullet = afterState.bullets.last()
        assertTrue(bullet.position.y < afterState.turret.position.y)
    }
}
