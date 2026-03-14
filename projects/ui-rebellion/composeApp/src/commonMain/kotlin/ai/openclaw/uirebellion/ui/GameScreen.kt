package ai.openclaw.uirebellion.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import ai.openclaw.uirebellion.game.ButtonEnemy
import ai.openclaw.uirebellion.game.BulletEntity
import ai.openclaw.uirebellion.game.GameUiState
import ai.openclaw.uirebellion.game.GameViewModel
import ai.openclaw.uirebellion.game.SwitchTrap
import kotlin.math.roundToInt

@Composable
fun GameScreen(viewModel: GameViewModel) {
    val uiState = viewModel.uiState

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF10131A))
            .onSizeChanged { size ->
                viewModel.onViewportChanged(size.width.toFloat(), size.height.toFloat())
            }
            .padding(12.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            HudCard(
                uiState = uiState,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 72.dp, bottom = 124.dp)
            ) {
                uiState.enemies.forEach { enemy ->
                    EnemyButton(enemy)
                }
                uiState.traps.forEach { trap ->
                    TrapSwitch(trap)
                }
                uiState.bullets.forEach { bullet ->
                    BulletCheckbox(bullet)
                }
                TurretFab(uiState)
            }

            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
            ) {
                Slider(
                    value = uiState.sliderValue,
                    onValueChange = viewModel::onSliderValueChange,
                    onValueChangeFinished = viewModel::onSliderRelease,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 52.dp)
                )

                Text(
                    text = "拖动 Slider 控制炮台；松手发射 Checkbox 子弹；命中 Button +10，打到 Switch -5",
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(end = 110.dp)
                )

                Button(
                    onClick = viewModel::restart,
                    modifier = Modifier.align(Alignment.BottomEnd)
                ) {
                    Text("重开一局")
                }
            }
        }
    }
}

@Composable
private fun HudCard(uiState: GameUiState, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(
            text = uiState.bestEffortHudText,
            modifier = Modifier.padding(16.dp)
        )
    }
}

@Composable
private fun EnemyButton(enemy: ButtonEnemy) {
    val position by remember(enemy.position) {
        derivedStateOf {
            IntOffset(enemy.position.x.roundToInt(), enemy.position.y.roundToInt())
        }
    }
    Button(
        onClick = {},
        modifier = Modifier
            .offset { position }
            .height(enemy.size.y.dp)
    ) {
        Text("叛乱 Button #${enemy.id}")
    }
}

@Composable
private fun TrapSwitch(trap: SwitchTrap) {
    val position by remember(trap.position) {
        derivedStateOf {
            IntOffset(trap.position.x.roundToInt(), trap.position.y.roundToInt())
        }
    }
    Switch(
        checked = trap.checked,
        onCheckedChange = null,
        modifier = Modifier.offset { position }
    )
}

@Composable
private fun BulletCheckbox(bullet: BulletEntity) {
    val position by remember(bullet.position) {
        derivedStateOf {
            IntOffset(bullet.position.x.roundToInt(), bullet.position.y.roundToInt())
        }
    }
    Checkbox(
        checked = true,
        onCheckedChange = null,
        modifier = Modifier.offset { position }
    )
}

@Composable
private fun TurretFab(uiState: GameUiState) {
    val position by remember(uiState.turret.position) {
        derivedStateOf {
            IntOffset(
                uiState.turret.position.x.roundToInt(),
                uiState.turret.position.y.roundToInt(),
            )
        }
    }
    FloatingActionButton(
        onClick = {},
        modifier = Modifier.offset { position }
    ) {
        Text("⬆")
    }
}
