import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '@/theme';

interface DataPoint {
  value: number | null;
  label?: string;
}

interface SparklineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  showArea?: boolean;
  strokeWidth?: number;
}

export function SparklineChart({
  data,
  width = 120,
  height = 36,
  color = colors.accent,
  showDots = false,
  showArea = false,
  strokeWidth = 1.5,
}: SparklineChartProps) {
  const valid = data.filter((d) => d.value != null) as Array<{ value: number; label?: string }>;
  if (valid.length < 2) return <View style={{ width, height }} />;

  const values = valid.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pad = 4;
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;

  const toX = (i: number) => pad + (i / (valid.length - 1)) * innerWidth;
  const toY = (v: number) => pad + (1 - (v - min) / range) * innerHeight;

  // Build SVG path
  let linePath = '';
  let areaPath = '';

  valid.forEach((d, i) => {
    const x = toX(i);
    const y = toY(d.value);
    if (i === 0) {
      linePath += `M ${x} ${y}`;
      areaPath += `M ${x} ${height} L ${x} ${y}`;
    } else {
      // Smooth curve using cubic bezier
      const prev = valid[i - 1];
      const px = toX(i - 1);
      const py = toY(prev.value);
      const cpx = px + (x - px) / 2;
      linePath += ` C ${cpx} ${py}, ${cpx} ${y}, ${x} ${y}`;
      areaPath += ` C ${cpx} ${py}, ${cpx} ${y}, ${x} ${y}`;
    }
  });

  const lastX = toX(valid.length - 1);
  areaPath += ` L ${lastX} ${height} Z`;

  return (
    <Svg width={width} height={height}>
      {showArea && (
        <Path
          d={areaPath}
          fill={color}
          fillOpacity={0.1}
          stroke="none"
        />
      )}
      <Path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        valid.map((d, i) => (
          <Circle
            key={i}
            cx={toX(i)}
            cy={toY(d.value)}
            r={2.5}
            fill={color}
          />
        ))}
    </Svg>
  );
}
