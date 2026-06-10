import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { TodayScreen } from '@/screens/today/TodayScreen';
import { SpaceScreen } from '@/screens/space/SpaceScreen';
import { BuildScreen } from '@/screens/build/BuildScreen';
import { MeScreen } from '@/screens/me/MeScreen';
import { QuickCaptureFAB } from '@/components/QuickCaptureFAB';
import { colors, spacing } from '@/theme';
import { TText } from '@/components/ui/TText';

export type TabParamList = {
  Today: undefined;
  Space: undefined;
  Build: undefined;
  Me: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ focused, label, symbol }: { focused: boolean; label: string; symbol: string }) {
  return (
    <View style={iconStyles.container} accessibilityLabel={label}>
      <TText style={[iconStyles.symbol, { opacity: focused ? 1 : 0.45 }]}>
        {symbol}
      </TText>
      <TText
        variant="small"
        style={[iconStyles.label, { color: focused ? colors.accent : colors.textSecondary }]}
      >
        {label}
      </TText>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 4,
    minWidth: 56,
    minHeight: 44,
  },
  symbol: {
    fontSize: 22,
  },
  label: {
    marginTop: 2,
    fontSize: 10,
  },
});

export function TabNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 84,
            paddingBottom: 24,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen
          name="Today"
          component={TodayScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} label="Today" symbol="◎" />
            ),
          }}
        />
        <Tab.Screen
          name="Space"
          component={SpaceScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} label="Space" symbol="✦" />
            ),
          }}
        />
        <Tab.Screen
          name="Build"
          component={BuildScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} label="Build" symbol="⬡" />
            ),
          }}
        />
        <Tab.Screen
          name="Me"
          component={MeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} label="Me" symbol="◑" />
            ),
          }}
        />
      </Tab.Navigator>

      {/* Global FAB — floats above tab bar */}
      <QuickCaptureFAB />
    </View>
  );
}
