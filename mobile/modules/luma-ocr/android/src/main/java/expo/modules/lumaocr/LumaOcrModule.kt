package expo.modules.lumaocr

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * LUMA's on-device reading engine.
 *
 * recognizeAsync(sourceUri, outputPath, maxDimension) -> JSON string
 *   Decodes the photo, applies EXIF orientation, scales it so the longest
 *   side is at most maxDimension, saves an upright JPEG without metadata to
 *   outputPath (inside the app's private files), measures blur/glare/light,
 *   then runs ML Kit Text Recognition v2 (bundled Latin model) on it.
 *   Bounding boxes are in the saved image's pixel coordinates.
 *
 * listVoicesAsync() -> JSON string
 *   Lists the phone's text-to-speech voices, including whether each needs a
 *   network connection or is not installed yet.
 */
class LumaOcrModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LumaOcr")

    Constant("engine") {
      "ML Kit Text Recognition v2 (Latin, bundled 16.0.1)"
    }

    AsyncFunction("recognizeAsync") Coroutine { sourceUri: String, outputPath: String, maxDimension: Int ->
      withContext(Dispatchers.Default) {
        Recognizer.recognize(context, sourceUri, outputPath, maxDimension)
      }
    }

    AsyncFunction("listVoicesAsync") Coroutine { ->
      VoiceInventory.list(context)
    }
  }
}
