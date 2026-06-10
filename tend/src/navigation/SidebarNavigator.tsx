import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { TodayScreen } from '@/screens/today/TodayScreen';
import { SpaceScreen } from '@/screens/space/SpaceScreen';
import { BuildScreen } from '@/screens/build/BuildScreen';
import { MeScreen } from '@/screens/me/MeScreen';
import { QuickCaptureFAB } from '@/components/QuickCaptureFAB';
import { TText } from '@/components/ui/TText';
import { Divider } from '@/components/ui/Divider';
import { colors, spacing } from '@/theme';

type TabName = 'Today' | 'Space' | 'Build' | 'Me';

const TABS: { name: TabName; symbol: string; label: string }[] = [
  { name: 'Today', symbol: '◎', label: 'Today' },
  { name: 'Space', symbol: '✦', label: 'Space' },
  { name: 'Build', symbol: '⬡', label: 'Build' },
  { name: 'Me', symbol: '◑', label: 'Me' },
];

function renderScreen(tab: TabName) {
  switch (tab) {
    case 'Today': return <TodayScreen />;
    case 'Space': return <SpaceScreen />;
    case 'Build': return <BuildScreen />;
    case 'Me': return <MeScreen />;
  }
}

export function SidebarNavigator() {
  const [activeTab, setActiveTab] = useState<TabName>('Today');

  return (
    <View style={styles.root}>
      {/* Left sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarTop}>
          <TText variant="heading" style={styles.appName}>Tend</TText>
          <Divider />
        </View>

        <View style={styles.navItems}>
          {TABS.map((tab) => {
            const active = activeTab === tab.name;
            return (
              <Pressable
                key={tab.name}
                onPress={() => setActiveTab(tab.name)}
                style={[styles.navItem, active && styles.navItemActive]}
                accessibilityLabel={tab.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <TText style={[styles.navSymbol, { opacity: active ? 1 : 0.5 }]}>
                  {tab.symbol}
                </TText>
                <TText
                  variant="medium"
                  style={{ color: active ? colors.accent : colors.textPrimary }}
                >
                  {tab.label}
                </TText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Divider vertical />

      {/* Content pane */}
      <View style={styles.content}>
        {renderScreen(activeTab)}
        <QuickCaptureFAB />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  sidebar: {
    width: 240,
    backgroundColor: colors.surface,
    paddingTop: 60,
  },
  sidebarTop: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[4],
  },
  appName: {
    color: colors.accent,
  },
  navItems: {
    paddingHorizontal: spacing[2],
    paddingTop: spacing[2],
    gap: spacing[1],
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: 10,
    minHeight: 44,
  },
  navItemActive: {
    backgroundColor: `${colors.accent}15`,
  },
  navSymbol: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
});
