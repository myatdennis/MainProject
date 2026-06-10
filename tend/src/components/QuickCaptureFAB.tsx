import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { TText } from './ui/TText';
import { colors, spacing, radius } from '@/theme';
import { FocusTimer } from './FocusTimer';

interface QuickCaptureFABProps {
  onCapture?: (type: 'text' | 'drawing' | 'voice', content: string) => void;
}

export function QuickCaptureFAB({ onCapture }: QuickCaptureFABProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [focusTimerVisible, setFocusTimerVisible] = useState(false);
  const [textValue, setTextValue] = useState('');

  const fabScale = useSharedValue(1);
  const sheetTranslateY = useSharedValue(300);
  const sheetOpacity = useSharedValue(0);

  const openSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetVisible(true);
    sheetTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    sheetOpacity.value = withTiming(1, { duration: 200 });
  }, []);

  const closeSheet = useCallback(() => {
    sheetTranslateY.value = withSpring(300, { damping: 20, stiffness: 300 });
    sheetOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setSheetVisible)(false);
    });
    setTextValue('');
    Keyboard.dismiss();
  }, []);

  const openFocusTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFocusTimerVisible(true);
  }, []);

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      runOnJS(openFocusTimer)();
    });

  const tapGesture = Gesture.Tap().onStart(() => {
    runOnJS(openSheet)();
  });

  const combinedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
    opacity: sheetOpacity.value,
  }));

  const handleTextCapture = () => {
    if (!textValue.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCapture?.('text', textValue.trim());
    closeSheet();
  };

  return (
    <>
      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={[styles.fab, fabAnimatedStyle]}>
          <TText style={styles.fabIcon}>+</TText>
        </Animated.View>
      </GestureDetector>

      {/* Quick Capture Sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
            <Pressable onPress={() => {}} style={styles.sheetInner}>
              {/* Handle */}
              <View style={styles.handle} />

              <TText variant="heading" style={styles.sheetTitle}>Capture</TText>

              {/* Text input */}
              <TextInput
                style={styles.textInput}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.textSecondary}
                value={textValue}
                onChangeText={setTextValue}
                multiline
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleTextCapture}
                accessibilityLabel="Quick capture text input"
              />

              {/* Action row */}
              <View style={styles.actionRow}>
                <CaptureOption
                  emoji="✍️"
                  label="Write"
                  onPress={handleTextCapture}
                />
                <CaptureOption
                  emoji="✏️"
                  label="Draw"
                  onPress={() => {
                    closeSheet();
                    // Navigate to drawing canvas — handled by parent
                    onCapture?.('drawing', '');
                  }}
                />
                <CaptureOption
                  emoji="🎙"
                  label="Voice"
                  onPress={() => {
                    closeSheet();
                    onCapture?.('voice', '');
                  }}
                />
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Focus Timer */}
      <FocusTimer
        visible={focusTimerVisible}
        onClose={() => setFocusTimerVisible(false)}
      />
    </>
  );
}

function CaptureOption({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.captureOption} onPress={onPress} accessibilityLabel={label}>
      <TText style={styles.captureEmoji}>{emoji}</TText>
      <TText variant="caption" color="secondary">{label}</TText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 24,
    right: spacing[4],
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetInner: {
    padding: spacing[4],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  sheetTitle: {
    marginBottom: spacing[3],
  },
  textInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[4],
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  captureOption: {
    alignItems: 'center',
    padding: spacing[3],
    minWidth: 80,
    minHeight: 44,
  },
  captureEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
});
