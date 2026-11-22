package expo.modules.lumaocr

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Rect
import android.media.ExifInterface
import android.net.Uri
import android.os.SystemClock
import com.google.android.gms.tasks.Task
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.max
import kotlin.math.roundToInt

class ImageUnreadableException(message: String, cause: Throwable? = null) :
  CodedException("ERR_IMAGE_UNREADABLE", message, cause)

class RecognitionFailedException(cause: Throwable?) :
  CodedException("ERR_RECOGNITION_FAILED", "Text recognition failed on this image.", cause)

object Recognizer {
  fun open(context: Context, uri: Uri): InputStream {
    return if (uri.scheme == null || uri.scheme == "file") {
      File(uri.path ?: throw ImageUnreadableException("The image path is empty.")).inputStream()
    } else {
      context.contentResolver.openInputStream(uri)
        ?: throw ImageUnreadableException("The image could not be opened.")
    }
  }

  suspend fun recognize(context: Context, sourceUri: String, outputPath: String, maxDimension: Int): String {
    val started = SystemClock.elapsedRealtime()
    val uri = Uri.parse(sourceUri)
    val limit = maxDimension.coerceIn(800, 4096)

    // 1. Read dimensions without decoding the whole image.
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    try {
      open(context, uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    } catch (e: Exception) {
      throw ImageUnreadableException("The image could not be opened.", e)
    }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw ImageUnreadableException("This file is not a supported image.")
    }

    // 2. Decode with power-of-two subsampling to stay within memory.
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= limit) sample *= 2
    val opts = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    val decoded = try {
      open(context, uri).use { BitmapFactory.decodeStream(it, null, opts) }
    } catch (e: OutOfMemoryError) {
      throw ImageUnreadableException("The image is too large to open on this phone.")
    } ?: throw ImageUnreadableException("The image could not be decoded.")

    // 3. Apply EXIF orientation so text is upright in the saved image.
    val orientation = try {
      open(context, uri).use {
        ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      }
    } catch (e: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }
    var image = applyOrientation(decoded, orientation)

    // 4. Final scale so the longest side is at most the limit.
    val longest = max(image.width, image.height)
    if (longest > limit) {
      val scale = limit.toFloat() / longest
      val scaled = Bitmap.createScaledBitmap(
        image, (image.width * scale).roundToInt(), (image.height * scale).roundToInt(), true
      )
      if (scaled != image) image.recycle()
      image = scaled
    }

    // 5. Save an upright JPEG. Re-encoding drops EXIF metadata, including
    //    any GPS location, from the copy LUMA keeps.
    val outFile = File(Uri.parse(outputPath).path ?: outputPath)
    outFile.parentFile?.mkdirs()
    FileOutputStream(outFile).use { image.compress(Bitmap.CompressFormat.JPEG, 88, it) }

    // 6. Photo quality signals used for retake advice.
    val quality = ImageQuality.measure(image)

    // 7. Recognise text with the bundled Latin model.
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    val result: Text = try {
      recognizer.process(InputImage.fromBitmap(image, 0)).await()
    } catch (e: Exception) {
      throw RecognitionFailedException(e)
    } finally {
      recognizer.close()
    }

    val json = JSONObject()
      .put("width", image.width)
      .put("height", image.height)
      .put("imageUri", Uri.fromFile(outFile).toString())
      .put("quality", quality.toJson())
      .put("blocks", blocksToJson(result))
      .put("durationMs", SystemClock.elapsedRealtime() - started)
    image.recycle()
    return json.toString()
  }

  private fun applyOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
    val m = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
      else -> return bitmap
    }
    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
    if (rotated != bitmap) bitmap.recycle()
    return rotated
  }

  private fun box(r: Rect?): Any = if (r == null) JSONObject.NULL else
    JSONObject().put("left", r.left).put("top", r.top).put("right", r.right).put("bottom", r.bottom)

  private fun conf(v: Float): Any = if (v.isNaN() || v <= 0f) JSONObject.NULL else v.toDouble()

  private fun blocksToJson(text: Text): JSONArray {
    val blocks = JSONArray()
    for (b in text.textBlocks) {
      val lines = JSONArray()
      for (l in b.lines) {
        val elements = JSONArray()
        for (e in l.elements) {
          elements.put(
            JSONObject()
              .put("text", e.text)
              .put("box", box(e.boundingBox))
              .put("confidence", conf(e.confidence))
          )
        }
        lines.put(
          JSONObject()
            .put("text", l.text)
            .put("box", box(l.boundingBox))
            .put("angle", l.angle.toDouble())
            .put("confidence", conf(l.confidence))
            .put("language", l.recognizedLanguage)
            .put("elements", elements)
        )
      }
      blocks.put(
        JSONObject()
          .put("text", b.text)
          .put("box", box(b.boundingBox))
          .put("language", b.recognizedLanguage)
          .put("lines", lines)
      )
    }
    return blocks
  }
}

suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { cont ->
  addOnSuccessListener { cont.resume(it) }
  addOnFailureListener { cont.resumeWithException(it) }
  addOnCanceledListener { cont.cancel() }
}
