import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

interface DividerProps {
  vertical?: boolean;
}

export function Divider({ vertical = false }: DividerProps) {
  return <View style={vertical ? styles.vertical : styles.horizontal} />;
}

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
  },
  vertical: {
    width: 1,
    backgroundColor: colors.border,
    alignSelf: 'stretch',
  },
});
