import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import { PenConfig, PenTool, PEN_DEFAULTS } from '@/lib/handwriting';

interface FloatingToolbarProps {
  penConfig: PenConfig;
  onPenChange: (config: PenConfig) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
}

const TOOLS: Array<{ tool: PenTool; label: string; icon: string }> = [
  { tool: 'ballpoint', label: 'Ball', icon: '🖊' },
  { tool: 'fountain', label: 'Fountain', icon: '✒️' },
  { tool: 'marker', label: 'Mark', icon: '🖍' },
  { tool: 'pencil', label: 'Pencil', icon: '✏️' },
];

const COLORS = [
  { color: '#1A1A1A', label: 'Black' },
  { color: '#2563EB', label: 'Blue' },
  { color: '#DC2626', label: 'Red' },
  { color: '#16A34A', label: 'Green' },
  { color: '#7C3AED', label: 'Purple' },
];

const WIDTHS: Array<{ value: number; label: string }> = [
  { value: 1.5, label: 'Fine' },
  { value: 2.5, label: 'Med' },
  { value: 4,   label: 'Thick' },
];

export function FloatingToolbar({
  penConfig,
  onPenChange,
  onUndo,
  onClear,
  canUndo,
}: FloatingToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useSharedValue(0);

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    expandAnim.value = withSpring(next ? 1 : 0, { damping: 18, stiffness: 280 });
  };

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: expandAnim.value,
    transform: [{ scaleY: expandAnim.value }, { scaleX: expandAnim.value }],
    pointerEvents: expandAnim.value > 0.5 ? 'auto' : 'none',
  }));

  const selectTool = (tool: PenTool) => {
    onPenChange({ ...penConfig, tool, width: PEN_DEFAULTS[tool].width });
    setExpanded(false);
    expandAnim.value = withTiming(0);
  };

  const selectColor = (color: string) => {
    onPenChange({ ...penConfig, color });
  };

  const selectWidth = (width: number) => {
    onPenChange({ ...penConfig, width });
  };

  return (
    <View style={styles.container}>
      {/* Expanded panel */}
      <Animated.View style={[styles.panel, expandedStyle]}>
        {/* Tool row */}
        <View style={styles.row}>
          {TOOLS.map(t => (
            <Pressable
              key={t.tool}
              onPress={() => selectTool(t.tool)}
              style={[styles.toolBtn, penConfig.tool === t.tool && styles.toolBtnActive]}
            >
              <TText style={styles.toolIcon}>{t.icon}</TText>
            </Pressable>
          ))}
        </View>

        <View style={styles.separator} />

        {/* Color row */}
        <View style={styles.row}>
          {COLORS.map(c => (
            <Pressable
              key={c.color}
              onPress={() => selectColor(c.color)}
              style={[styles.colorDot, { backgroundColor: c.color },
                penConfig.color === c.color && styles.colorDotSelected]}
            />
          ))}
        </View>

        <View style={styles.separator} />

        {/* Width row */}
        <View style={styles.row}>
          {WIDTHS.map(w => (
            <Pressable
              key={w.value}
              onPress={() => selectWidth(w.value)}
              style={[styles.widthBtn, penConfig.width === w.value && styles.widthBtnActive]}
            >
              <View style={[styles.widthLine, { height: Math.max(1.5, w.value) }]} />
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Main toolbar row */}
      <View style={styles.mainRow}>
        {/* Undo */}
        <Pressable
          onPress={onUndo}
          disabled={!canUndo}
          style={[styles.actionBtn, !canUndo && styles.actionBtnDisabled]}
          accessibilityLabel="Undo last stroke"
        >
          <TText style={styles.actionIcon}>↩</TText>
        </Pressable>

        {/* Pen picker toggle */}
        <Pressable
          onPress={toggleExpand}
          style={[styles.penBtn, expanded && styles.penBtnActive]}
          accessibilityLabel="Open pen tools"
        >
          <View style={[styles.penPreview, {
            backgroundColor: penConfig.color,
            height: Math.max(2, penConfig.width),
          }]} />
        </Pressable>

        {/* Current color dot */}
        <View style={[styles.colorIndicator, { backgroundColor: penConfig.color }]} />

        {/* Clear */}
        <Pressable
          onPress={onClear}
          style={styles.actionBtn}
          accessibilityLabel="Clear page"
        >
          <TText style={styles.actionIcon}>🗑</TText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing[3],
    gap: spacing[2],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    transformOrigin: 'bottom',
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: -spacing[1],
  },
  mainRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 32,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[3],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.35,
  },
  actionIcon: {
    fontSize: 18,
  },
  penBtn: {
    width: 52,
    height: 36,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  penBtnActive: {
    backgroundColor: `${colors.accent}20`,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  penPreview: {
    width: 28,
    borderRadius: 4,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  toolBtn: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  toolBtnActive: {
    backgroundColor: `${colors.accent}20`,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  toolIcon: {
    fontSize: 18,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  colorDotSelected: {
    borderWidth: 2.5,
    borderColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  widthBtn: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  widthBtnActive: {
    backgroundColor: `${colors.accent}20`,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  widthLine: {
    width: 24,
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
  },
});
