package expo.modules.lumaocr

import android.graphics.Bitmap
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Cheap photo-quality signals measured on a 512 px greyscale copy.
 *
 * sharpness  variance of the Laplacian; low values mean blur.
 * brightness mean luminance 0-255; low values mean a dark photo.
 * contrast   standard deviation of luminance; low values mean a washed-out photo.
 * glare      share of pixels that are clipped near-white (>= 250), which on a
 *            page usually means reflected light covering the text.
 *
 * Thresholds are applied in JavaScript (src/ocr/advice.ts) so they can be
 * tuned without a native rebuild.
 */
data class ImageQuality(
  val sharpness: Double,
  val brightness: Double,
  val contrast: Double,
  val glare: Double
) {
  fun toJson(): JSONObject = JSONObject()
    .put("sharpness", sharpness)
    .put("brightness", brightness)
    .put("contrast", contrast)
    .put("glare", glare)

  companion object {
    fun measure(source: Bitmap): ImageQuality {
      val longest = max(source.width, source.height)
      val scale = if (longest > 512) 512f / longest else 1f
      val w = max(3, (source.width * scale).roundToInt())
      val h = max(3, (source.height * scale).roundToInt())
      val small = if (scale < 1f) Bitmap.createScaledBitmap(source, w, h, true) else source
      val pixels = IntArray(w * h)
      small.getPixels(pixels, 0, w, 0, 0, w, h)
      if (small != source) small.recycle()

      val lum = DoubleArray(w * h)
      var sum = 0.0
      var clipped = 0
      for (i in pixels.indices) {
        val p = pixels[i]
        val r = (p shr 16) and 0xff
        val g = (p shr 8) and 0xff
        val b = p and 0xff
        val y = 0.299 * r + 0.587 * g + 0.114 * b
        lum[i] = y
        sum += y
        if (y >= 250.0) clipped++
      }
      val n = lum.size.toDouble()
      val mean = sum / n
      var varSum = 0.0
      for (y in lum) varSum += (y - mean) * (y - mean)
      val std = sqrt(varSum / n)

      var lapSum = 0.0
      var lapSq = 0.0
      var count = 0
      for (y in 1 until h - 1) {
        for (x in 1 until w - 1) {
          val i = y * w + x
          val v = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w]
          lapSum += v
          lapSq += v * v
          count++
        }
      }
      val lapMean = if (count > 0) lapSum / count else 0.0
      val lapVar = if (count > 0) lapSq / count - lapMean * lapMean else 0.0

      return ImageQuality(
        sharpness = lapVar,
        brightness = mean,
        contrast = std,
        glare = clipped / n
      )
    }
  }
}
