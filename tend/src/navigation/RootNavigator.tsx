import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useWindowDimensions } from 'react-native';
import { TabNavigator } from './TabNavigator';
import { SidebarNavigator } from './SidebarNavigator';
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { useAuth } from '@/hooks/useAuth';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const IPAD_MIN_WIDTH = 768;

export function RootNavigator() {
  const { width } = useWindowDimensions();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Stack.Screen
            name="Main"
            component={width >= IPAD_MIN_WIDTH ? SidebarNavigator : TabNavigator}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
