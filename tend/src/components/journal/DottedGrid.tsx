import React from 'react';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { colors } from '@/theme';

interface DottedGridProps {
  width: number;
  height: number;
  spacing?: number;
  dotRadius?: number;
  color?: string;
}

export function DottedGrid({
  width,
  height,
  spacing = 24,
  dotRadius = 1,
  color = colors.textSecondary + '30',
}: DottedGridProps) {
  const dots: { x: number; y: number }[] = [];

  for (let x = spacing; x < width; x += spacing) {
    for (let y = spacing; y < height; y += spacing) {
      dots.push({ x, y });
    }
  }

  return (
    <Canvas style={{ position: 'absolute', width, height, top: 0, left: 0 }} pointerEvents="none">
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={dotRadius} color={color} />
      ))}
    </Canvas>
  );
}
