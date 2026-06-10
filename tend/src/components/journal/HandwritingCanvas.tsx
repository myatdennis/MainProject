import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Path,
  Paint,
  BlendMode,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import { colors } from '@/theme';
import { buildSkiaPath, getStrokeWidth, PenConfig, Stroke, StrokePoint } from '@/lib/handwriting';
import { DottedGrid } from './DottedGrid';

interface HandwritingCanvasProps {
  strokes: Stroke[];
  penConfig: PenConfig;
  width: number;
  height: number;
  onStrokeComplete: (stroke: Stroke) => void;
  readOnly?: boolean;
}

let strokeIdCounter = 0;
function nextStrokeId() { return `s_${Date.now()}_${++strokeIdCounter}`; }

export function HandwritingCanvas({
  strokes,
  penConfig,
  width,
  height,
  onStrokeComplete,
  readOnly = false,
}: HandwritingCanvasProps) {
  // Current in-progress stroke (not committed to state to avoid re-renders)
  const currentPointsRef = useRef<StrokePoint[]>([]);
  const isStylus = useRef(false);
  const [, forceUpdate] = useState(0);

  const handlePanStart = useCallback((e: GestureUpdateEvent<PanGestureHandlerEventPayload> & { pointerType?: string; pressure?: number }) => {
    if (readOnly) return;
    const pointerType = (e as any).pointerType;
    // Palm rejection: only accept stylus when a stylus is detected
    isStylus.current = pointerType === 'stylus';
    currentPointsRef.current = [{
      x: e.x,
      y: e.y,
      pressure: (e as any).pressure ?? 0.5,
      timestamp: Date.now(),
    }];
    forceUpdate(n => n + 1);
  }, [readOnly]);

  const handlePanUpdate = useCallback((e: GestureUpdateEvent<PanGestureHandlerEventPayload> & { pointerType?: string; pressure?: number }) => {
    if (readOnly) return;
    const pointerType = (e as any).pointerType;
    // Multi-touch palm rejection
    const numPointers = (e as any).numberOfPointers ?? 1;
    if (numPointers > 1 && pointerType !== 'stylus') return;
    if (isStylus.current && pointerType !== 'stylus') return;

    currentPointsRef.current.push({
      x: e.x,
      y: e.y,
      pressure: (e as any).pressure ?? 0.5,
      timestamp: Date.now(),
    });
    forceUpdate(n => n + 1);
  }, [readOnly]);

  const handlePanEnd = useCallback(() => {
    if (readOnly) return;
    const points = currentPointsRef.current;
    if (points.length === 0) return;

    const stroke: Stroke = {
      id: nextStrokeId(),
      points,
      color: penConfig.color,
      width: penConfig.width,
      tool: penConfig.tool,
    };

    currentPointsRef.current = [];
    forceUpdate(n => n + 1);
    onStrokeComplete(stroke);
  }, [readOnly, penConfig, onStrokeComplete]);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onStart(handlePanStart as any)
    .onUpdate(handlePanUpdate as any)
    .onEnd(handlePanEnd)
    .runOnJS(true);

  const currentPath = currentPointsRef.current.length > 0
    ? buildSkiaPath(currentPointsRef.current, penConfig.tool, penConfig.width)
    : null;

  const isMarker = penConfig.tool === 'marker';

  return (
    <View style={[styles.container, { width, height }]}>
      <DottedGrid width={width} height={height} />

      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height }}>
          {/* Completed strokes */}
          {strokes.map(stroke => {
            const skPath = buildSkiaPath(stroke.points, stroke.tool, stroke.width);
            const strokeWidth = stroke.points.length > 0
              ? getStrokeWidth(stroke.tool, stroke.width, stroke.points[0].pressure)
              : stroke.width;
            return (
              <Path
                key={stroke.id}
                path={skPath}
                style="stroke"
                strokeWidth={strokeWidth}
                strokeCap="round"
                strokeJoin="round"
                color={stroke.color}
                opacity={stroke.tool === 'marker' ? 0.6 : 1}
                blendMode={stroke.tool === 'marker' ? BlendMode.Multiply : BlendMode.SrcOver}
              />
            );
          })}

          {/* Active stroke */}
          {currentPath && (
            <Path
              path={currentPath}
              style="stroke"
              strokeWidth={getStrokeWidth(
                penConfig.tool,
                penConfig.width,
                currentPointsRef.current.slice(-1)[0]?.pressure ?? 0.5
              )}
              strokeCap="round"
              strokeJoin="round"
              color={penConfig.color}
              opacity={isMarker ? 0.6 : penConfig.opacity}
              blendMode={isMarker ? BlendMode.Multiply : BlendMode.SrcOver}
            />
          )}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
