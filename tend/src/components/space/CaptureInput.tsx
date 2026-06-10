import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';

interface CaptureInputProps {
  onAdd: (text: string) => void;
  placeholder?: string;
}

export function CaptureInput({ onAdd, placeholder = 'What's on your mind?' }: CaptureInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
    // Keep keyboard open for rapid capture
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        multiline
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        blurOnSubmit={false}
        autoFocus
        autoCorrect={false}
        textAlignVertical="top"
      />
      <Pressable
        onPress={handleSubmit}
        disabled={!text.trim()}
        style={[styles.addBtn, !text.trim() && styles.addBtnDisabled]}
        accessibilityLabel="Add thought"
      >
        <TText style={styles.addBtnText}>+</TText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing[3],
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 22,
    maxHeight: 100,
    minHeight: 36,
    fontFamily: 'System',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: colors.border,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '300',
  },
});
