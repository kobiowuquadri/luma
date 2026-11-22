package expo.modules.lumaocr

import android.content.Context
import android.speech.tts.TextToSpeech
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.resume

/**
 * Lists the phone's text-to-speech voices with the details LUMA needs to
 * label "Read original aloud" honestly: whether a voice needs a network
 * connection and whether its data is installed.
 */
object VoiceInventory {
  suspend fun list(context: Context): String {
    val result = withTimeoutOrNull(8000) {
      withContext(Dispatchers.Main) {
        suspendCancellableCoroutine<String> { cont ->
          var tts: TextToSpeech? = null
          tts = TextToSpeech(context.applicationContext) { status ->
            val voices = JSONArray()
            var engine: String? = null
            if (status == TextToSpeech.SUCCESS) {
              try {
                engine = tts?.defaultEngine
                tts?.voices?.forEach { v ->
                  val features = v.features ?: emptySet()
                  voices.put(
                    JSONObject()
                      .put("name", v.name)
                      .put("locale", v.locale.toLanguageTag())
                      .put("language", v.locale.language)
                      .put("networkRequired", v.isNetworkConnectionRequired)
                      .put("notInstalled", features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))
                      .put("quality", v.quality)
                  )
                }
              } catch (e: Exception) {
                // Some engines throw while enumerating; report what we have.
              }
            }
            try { tts?.shutdown() } catch (e: Exception) {}
            val json = JSONObject()
              .put("ok", status == TextToSpeech.SUCCESS)
              .put("engine", engine ?: JSONObject.NULL)
              .put("voices", voices)
            if (cont.isActive) cont.resume(json.toString())
          }
        }
      }
    }
    return result ?: JSONObject().put("ok", false).put("engine", JSONObject.NULL).put("voices", JSONArray()).toString()
  }
}
