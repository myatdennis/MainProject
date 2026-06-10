import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { TText } from './ui/TText';
import { Card } from './ui/Card';
import { colors, spacing } from '@/theme';
import type { CaptureItem } from '@/types';

interface SpaceInboxProps {
  items: CaptureItem[];
  onItemPress?: (item: CaptureItem) => void;
}

export function SpaceInbox({ items, onItemPress }: SpaceInboxProps) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <TText variant="body" color="secondary" style={styles.emptyText}>
          Your captures land here.{'\n'}Nothing to organize yet.
        </TText>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <InboxItem item={item} onPress={() => onItemPress?.(item)} />
      )}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
}

function InboxItem({ item, onPress }: { item: CaptureItem; onPress: () => void }) {
  const icon = item.type === 'voice' ? '🎙' : item.type === 'drawing' ? '✏️' : '✍️';
  const time = new Date(item.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Pressable onPress={onPress} accessibilityLabel={`Capture: ${item.content}`}>
      <Card style={styles.item}>
        <View style={styles.itemHeader}>
          <TText style={styles.icon}>{icon}</TText>
          <TText variant="mono" color="secondary">{time}</TText>
        </View>
        <TText variant="body" numberOfLines={3} style={styles.content}>
          {item.content || (item.type === 'voice' ? 'Voice memo' : 'Drawing')}
        </TText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing[2],
    padding: spacing[4],
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 24,
  },
  item: {
    gap: spacing[2],
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    fontSize: 16,
  },
  content: {
    color: colors.textPrimary,
  },
});
