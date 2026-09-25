package fr.tunebox.app;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Plein ecran permanent. Sur une tablette d'enfant, la barre de statut n'a rien
 * a dire et chacune de ses icones devient un bouton a tapoter ; la barre de
 * navigation, elle, est la sortie la plus directe de l'application.
 *
 * `android:windowFullscreen` dans le theme ne suffit plus depuis Android 11 :
 * il faut passer par le controleur d'insets, et le rejouer a chaque retour en
 * avant-plan puisque le systeme reaffiche les barres apres un balayage.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        // Un balayage depuis un bord fait reapparaitre les barres le temps d'un
        // geste, puis elles repartent : c'est la sortie de secours du parent.
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
