import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { TText } from '@/components/ui/TText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, radius } from '@/theme';
import { supabase } from '@/lib/supabase';

type Step =
  | 'welcome'
  | 'auth'
  | 'health'
  | 'goal'
  | 'trainingDays'
  | 'yoga'
  | 'notification'
  | 'done';

type FitnessGoal = 'strength' | 'recomposition' | 'feel_better' | 'all';
type YogaTime = 'morning' | 'evening';

interface OnboardingState {
  email: string;
  password: string;
  goal: FitnessGoal | null;
  trainingDays: number;
  yogaTime: YogaTime | null;
  notifications: boolean;
}

export function OnboardingScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const [state, setState] = useState<OnboardingState>({
    email: '',
    password: '',
    goal: null,
    trainingDays: 4,
    yogaTime: null,
    notifications: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuth() {
    if (!state.email || !state.password) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email: state.email,
      password: state.password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStep('health');
    }
  }

  function advance() {
    const flow: Step[] = ['welcome', 'auth', 'health', 'goal', 'trainingDays', 'yoga', 'notification', 'done'];
    const idx = flow.indexOf(step);
    if (idx < flow.length - 1) setStep(flow[idx + 1]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {step === 'welcome' && (
            <WelcomeStep onNext={advance} />
          )}
          {step === 'auth' && (
            <AuthStep
              email={state.email}
              password={state.password}
              onEmailChange={(email) => setState((s) => ({ ...s, email }))}
              onPasswordChange={(password) => setState((s) => ({ ...s, password }))}
              onSubmit={handleAuth}
              loading={loading}
              error={error}
            />
          )}
          {step === 'health' && (
            <HealthStep onNext={advance} />
          )}
          {step === 'goal' && (
            <GoalStep
              selected={state.goal}
              onSelect={(goal) => setState((s) => ({ ...s, goal }))}
              onNext={advance}
            />
          )}
          {step === 'trainingDays' && (
            <TrainingDaysStep
              days={state.trainingDays}
              onSelect={(trainingDays) => setState((s) => ({ ...s, trainingDays }))}
              onNext={advance}
            />
          )}
          {step === 'yoga' && (
            <YogaStep
              selected={state.yogaTime}
              onSelect={(yogaTime) => setState((s) => ({ ...s, yogaTime }))}
              onNext={advance}
            />
          )}
          {step === 'notification' && (
            <NotificationStep
              onEnable={() => { setState((s) => ({ ...s, notifications: true })); advance(); }}
              onSkip={advance}
            />
          )}
          {step === 'done' && (
            <DoneStep />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <View style={stepStyles.container}>
      <TText variant="display" style={stepStyles.title}>Tend</TText>
      <TText variant="body" color="secondary" style={stepStyles.subtitle}>
        Your one place to think, move, and recover.
      </TText>
      <Button label="Get started" onPress={onNext} size="lg" fullWidth />
    </View>
  );
}

function AuthStep({
  email, password, onEmailChange, onPasswordChange, onSubmit, loading, error,
}: {
  email: string; password: string;
  onEmailChange: (v: string) => void; onPasswordChange: (v: string) => void;
  onSubmit: () => void; loading: boolean; error: string | null;
}) {
  return (
    <View style={stepStyles.container}>
      <TText variant="title">Create your account</TText>
      <TextInput
        style={inputStyles.input}
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        accessibilityLabel="Email address"
      />
      <TextInput
        style={inputStyles.input}
        placeholder="Password"
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
        accessibilityLabel="Password"
      />
      {error && <TText variant="caption" color="danger">{error}</TText>}
      <Button label={loading ? 'Creating account…' : 'Continue'} onPress={onSubmit} size="lg" fullWidth disabled={loading} />
    </View>
  );
}

function HealthStep({ onNext }: { onNext: () => void }) {
  return (
    <View style={stepStyles.container}>
      <TText variant="title">Connect Apple Health</TText>
      <TText variant="body" color="secondary" style={stepStyles.subtitle}>
        Tend reads your HRV, heart rate, and sleep to calculate your daily recovery score.
        Your data stays on your device and is never sold.
      </TText>
      <Card style={{ padding: spacing[4], gap: spacing[3] }}>
        {[
          ['Heart Rate Variability (HRV)', 'Primary recovery signal'],
          ['Resting Heart Rate', 'Baseline cardiovascular health'],
          ['Sleep Analysis', 'Duration + efficiency'],
          ['Active Energy', 'Daily movement'],
          ['Workouts', 'Session history'],
        ].map(([metric, desc]) => (
          <View key={metric} style={{ gap: 2 }}>
            <TText variant="medium">{metric}</TText>
            <TText variant="caption" color="secondary">{desc}</TText>
          </View>
        ))}
      </Card>
      <Button label="Connect Apple Health" onPress={onNext} size="lg" fullWidth />
    </View>
  );
}

function GoalStep({
  selected, onSelect, onNext,
}: { selected: string | null; onSelect: (g: FitnessGoal) => void; onNext: () => void }) {
  const goals: { key: FitnessGoal; label: string; desc: string }[] = [
    { key: 'strength', label: 'Get stronger', desc: 'Build functional strength' },
    { key: 'recomposition', label: 'Recomposition', desc: 'Build muscle, lose fat' },
    { key: 'feel_better', label: 'Feel better', desc: 'Energy, mobility, recovery' },
    { key: 'all', label: 'All three', desc: 'The full picture' },
  ];
  return (
    <View style={stepStyles.container}>
      <TText variant="title">What's your goal?</TText>
      <View style={{ gap: spacing[2] }}>
        {goals.map((g) => (
          <Card
            key={g.key}
            style={[{ padding: spacing[4] }, selected === g.key && { borderColor: colors.accent }]}
          >
            <Button
              label={g.label}
              onPress={() => { onSelect(g.key); }}
              variant={selected === g.key ? 'primary' : 'ghost'}
              fullWidth
            />
            <TText variant="caption" color="secondary">{g.desc}</TText>
          </Card>
        ))}
      </View>
      <Button label="Continue" onPress={onNext} size="lg" fullWidth disabled={!selected} />
    </View>
  );
}

function TrainingDaysStep({
  days, onSelect, onNext,
}: { days: number; onSelect: (d: number) => void; onNext: () => void }) {
  return (
    <View style={stepStyles.container}>
      <TText variant="title">Training days per week?</TText>
      <View style={{ flexDirection: 'row', gap: spacing[2], justifyContent: 'center' }}>
        {[2, 3, 4, 5].map((d) => (
          <Button
            key={d}
            label={String(d)}
            onPress={() => onSelect(d)}
            variant={days === d ? 'primary' : 'secondary'}
            size="lg"
          />
        ))}
      </View>
      <Button label="Continue" onPress={onNext} size="lg" fullWidth />
    </View>
  );
}

function YogaStep({
  selected, onSelect, onNext,
}: { selected: string | null; onSelect: (t: YogaTime) => void; onNext: () => void }) {
  return (
    <View style={stepStyles.container}>
      <TText variant="title">Yoga: morning or evening?</TText>
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <Button
          label="Morning"
          onPress={() => onSelect('morning')}
          variant={selected === 'morning' ? 'primary' : 'secondary'}
          size="lg"
        />
        <Button
          label="Evening"
          onPress={() => onSelect('evening')}
          variant={selected === 'evening' ? 'primary' : 'secondary'}
          size="lg"
        />
      </View>
      <Button label="Continue" onPress={onNext} size="lg" fullWidth disabled={!selected} />
    </View>
  );
}

function NotificationStep({ onEnable, onSkip }: { onEnable: () => void; onSkip: () => void }) {
  return (
    <View style={stepStyles.container}>
      <TText variant="title">A gentle morning nudge?</TText>
      <TText variant="body" color="secondary" style={stepStyles.subtitle}>
        One notification at 7:30am if you haven't opened the app.{'\n\n'}
        "One thing is enough. What's your one thing?"
      </TText>
      <Button label="Yes, enable it" onPress={onEnable} size="lg" fullWidth />
      <Button label="No thanks" onPress={onSkip} variant="ghost" size="lg" fullWidth />
    </View>
  );
}

function DoneStep() {
  return (
    <View style={stepStyles.container}>
      <TText variant="display" style={stepStyles.title}>You're in.</TText>
      <TText variant="body" color="secondary" style={stepStyles.subtitle}>
        Today is a fresh page.
      </TText>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing[6],
    paddingVertical: spacing[8],
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
  },
});

const inputStyles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 52,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: spacing[6],
  },
});
