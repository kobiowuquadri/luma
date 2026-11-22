import { forwardRef, useImperativeHandle, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import type { Box } from '@/ocr/layout';
import { useTheme } from '@/theme/ThemeProvider';

export interface Overlay {
  box: Box;
  kind: 'line' | 'uncertain';
}

export interface ZoomHandle {
  zoomBy: (factor: number) => number;
  fit: () => void;
  focusBox: (box: Box) => void;
}

const MAX_SCALE = 8;

function clampT(v: number, s: number, container: number, displayed: number): number {
  'worklet';
  const max = Math.max(0, (displayed * s - container) / 2);
  return Math.min(max, Math.max(-max, v));
}

/**
 * The original photo with pinch-to-zoom and drag, plus outlines for the
 * cited line and uncertain words. Buttons outside drive the same zoom for
 * students who cannot pinch.
 */
export const ZoomableImage = forwardRef<ZoomHandle, { uri: string; width: number; height: number; overlays: Overlay[] }>(function ZoomableImage(
  { uri, width, height, overlays },
  ref,
) {
  const t = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const ds = size.w && size.h ? Math.min(size.w / width, size.h / height) : 0;
  const dispW = width * ds;
  const dispH = height * ds;
  const offX = (size.w - dispW) / 2;
  const offY = (size.h - dispH) / 2;
  const animate = (v: number) => (t.reduceMotion ? v : withTiming(v, { duration: 220 }));

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
      tx.value = clampT(tx.value, scale.value, size.w, dispW);
      ty.value = clampT(ty.value, scale.value, size.h, dispH);
    },
    onDeactivate: () => {
      'worklet';
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    },
  });
  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      tx.value = clampT(savedTx.value + e.translationX, scale.value, size.w, dispW);
      ty.value = clampT(savedTy.value + e.translationY, scale.value, size.h, dispH);
    },
    onDeactivate: () => {
      'worklet';
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const setAll = (s: number, x: number, y: number) => {
    const cx = clampT(x, s, size.w, dispW);
    const cy = clampT(y, s, size.h, dispH);
    scale.value = animate(s);
    tx.value = animate(cx);
    ty.value = animate(cy);
    savedScale.value = s;
    savedTx.value = cx;
    savedTy.value = cy;
  };

  useImperativeHandle(ref, () => ({
    zoomBy: (factor: number) => {
      const s = Math.min(MAX_SCALE, Math.max(1, savedScale.value * factor));
      setAll(s, savedTx.value * (s / savedScale.value), savedTy.value * (s / savedScale.value));
      return s;
    },
    fit: () => setAll(1, 0, 0),
    focusBox: (box: Box) => {
      if (!ds) return;
      const bw = (box.right - box.left) * ds;
      const bh = (box.bottom - box.top) * ds;
      const s = Math.min(MAX_SCALE, Math.max(1.5, Math.min(size.w / (bw * 1.15), size.h / (bh * 6))));
      const px = offX + ((box.left + box.right) / 2) * ds - size.w / 2;
      const py = offY + ((box.top + box.bottom) / 2) * ds - size.h / 2;
      setAll(s, -px * s, -py * s);
    },
  }));

  return (
    <View
      style={{ flex: 1, overflow: 'hidden', backgroundColor: t.palette.surfaceSunken }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Original photo of the page. Pinch to zoom and drag to move, or use the zoom buttons."
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width: size.w, height: size.h }, style]}>
          {ds > 0 ? (
            <>
              <Image source={{ uri }} style={{ position: 'absolute', left: offX, top: offY, width: dispW, height: dispH }} contentFit="fill" />
              {overlays.map((o, i) => (
                <View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: offX + o.box.left * ds - 3,
                    top: offY + o.box.top * ds - 3,
                    width: (o.box.right - o.box.left) * ds + 6,
                    height: (o.box.bottom - o.box.top) * ds + 6,
                    borderWidth: o.kind === 'line' ? 3 : 2,
                    borderRadius: 3,
                    borderColor: o.kind === 'line' ? t.palette.accent : t.palette.uncertain,
                    backgroundColor: o.kind === 'line' ? 'rgba(243, 213, 115, 0.35)' : 'transparent',
                  }}
                />
              ))}
            </>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});
