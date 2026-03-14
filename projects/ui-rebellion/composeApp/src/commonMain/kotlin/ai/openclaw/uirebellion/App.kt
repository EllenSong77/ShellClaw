package ai.openclaw.uirebellion

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import ai.openclaw.uirebellion.game.GameViewModel
import ai.openclaw.uirebellion.ui.GameScreen

@Composable
fun UiRebellionApp() {
    val viewModel = remember { GameViewModel() }
    GameScreen(viewModel = viewModel)
}
