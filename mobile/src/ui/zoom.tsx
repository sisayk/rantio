// Pinch and double-tap to zoom a photo, then drag it around. Android's scroll views
// can't zoom (iPhone's can, so the iPhone viewer uses those).
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const MAX = 4;
const DOUBLE = 2.5;

export function Zoomable({
  width,
  height,
  contentHeight,
  onZoomed,
  children,
}: {
  width: number;
  height: number;
  /** The photo's drawn height, so it can't be dragged past its edges. */
  contentHeight: number;
  /** True while zoomed in: the viewer stops swiping between photos meanwhile. */
  onZoomed: (zoomed: boolean) => void;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  const report = (z: boolean) => {
    setZoomed(z);
    onZoomed(z);
  };

  const clampX = (v: number, s: number) => {
    "worklet";
    const max = Math.max(0, (width * s - width) / 2);
    return Math.min(max, Math.max(-max, v));
  };
  const clampY = (v: number, s: number) => {
    "worklet";
    const max = Math.max(0, (contentHeight * s - height) / 2);
    return Math.min(max, Math.max(-max, v));
  };

  const pinch = usePinchGesture({
    onBegin: () => {
      "worklet";
      startScale.set(scale.get());
    },
    onUpdate: (e) => {
      "worklet";
      scale.set(Math.min(MAX * 1.2, Math.max(0.8, startScale.get() * e.scale)));
    },
    onDeactivate: () => {
      "worklet";
      const s = Math.min(MAX, Math.max(1, scale.get()));
      scale.set(withTiming(s));
      x.set(withTiming(s === 1 ? 0 : clampX(x.get(), s)));
      y.set(withTiming(s === 1 ? 0 : clampY(y.get(), s)));
      scheduleOnRN(report, s > 1);
    },
  });

  const pan = usePanGesture({
    enabled: zoomed,
    averageTouches: true,
    onBegin: () => {
      "worklet";
      startX.set(x.get());
      startY.set(y.get());
    },
    onUpdate: (e) => {
      "worklet";
      x.set(clampX(startX.get() + e.translationX, scale.get()));
      y.set(clampY(startY.get() + e.translationY, scale.get()));
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: (e) => {
      "worklet";
      if (e.canceled) return;
      const s = scale.get() > 1 ? 1 : DOUBLE;
      scale.set(withTiming(s));
      // Zoom in towards the tapped spot.
      x.set(withTiming(s === 1 ? 0 : clampX((width / 2 - e.x) * (s - 1), s)));
      y.set(withTiming(s === 1 ? 0 : clampY((height / 2 - e.y) * (s - 1), s)));
      scheduleOnRN(report, s > 1);
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          width,
          height,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
        collapsable={false}
      >
        <Animated.View style={style}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}
