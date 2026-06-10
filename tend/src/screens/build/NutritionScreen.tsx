import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { MacroRing } from '@/components/nutrition/MacroRing';
import { useNutrition } from '@/hooks/useNutrition';
import { FOOD_PRESETS, FoodEntry } from '@/lib/nutrition';
import { colors, spacing } from '@/theme';

const MEAL_ORDER: FoodEntry['meal'][] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function NutritionScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const { log, targets, totals, proteinPct, add, remove } = useNutrition(today);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<FoodEntry['meal']>('lunch');

  const openPicker = (meal: FoodEntry['meal']) => {
    setSelectedMeal(meal);
    setPickerVisible(true);
  };

  const handleAdd = (preset: typeof FOOD_PRESETS[0]) => {
    add({ ...preset, meal: selectedMeal });
    setPickerVisible(false);
  };

  const entriesByMeal = (meal: FoodEntry['meal']) =>
    log.entries.filter(e => e.meal === meal);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          {/* Macro rings */}
          <Card style={styles.ringCard}>
            <TText variant="heading">Today</TText>
            <View style={styles.rings}>
              <MacroRing label="Protein" value={totals.protein} target={targets.protein} unit="g" color={colors.success} />
              <MacroRing label="Calories" value={totals.calories} target={targets.calories} unit="kcal" color={colors.accent} size={96} />
              <MacroRing label="Carbs" value={totals.carbs} target={targets.carbs} unit="g" color={colors.warning} />
            </View>
            <View style={styles.fatRow}>
              <TText variant="small" color="secondary">Fat: {Math.round(totals.fat)}g / {targets.fat}g</TText>
              {proteinPct >= 0.9 && (
                <TText variant="small" style={styles.proteinBadge}>Protein goal ✓</TText>
              )}
            </View>
          </Card>
        </Animated.View>

        <Divider />

        {/* Meal sections */}
        {MEAL_ORDER.map(meal => {
          const entries = entriesByMeal(meal);
          const mealCalories = entries.reduce((s, e) => s + e.calories, 0);
          return (
            <Animated.View key={meal} entering={FadeInDown.duration(400)} style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <TText variant="medium" style={styles.mealTitle}>
                  {meal.charAt(0).toUpperCase() + meal.slice(1)}
                </TText>
                {mealCalories > 0 && (
                  <TText variant="caption" color="secondary">{mealCalories} kcal</TText>
                )}
                <Pressable
                  onPress={() => openPicker(meal)}
                  style={styles.addMealBtn}
                  accessibilityLabel={`Add food to ${meal}`}
                >
                  <TText style={styles.addMealIcon}>+</TText>
                </Pressable>
              </View>

              {entries.length === 0 ? (
                <Pressable onPress={() => openPicker(meal)} style={styles.emptyMeal}>
                  <TText variant="small" color="secondary" style={styles.emptyMealText}>
                    Tap to log {meal}
                  </TText>
                </Pressable>
              ) : (
                entries.map(entry => (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={styles.entryInfo}>
                      <TText variant="body">{entry.name}</TText>
                      <TText variant="small" color="secondary">
                        {entry.calories}kcal · P:{entry.protein}g · C:{entry.carbs}g · F:{entry.fat}g
                      </TText>
                    </View>
                    <Pressable
                      onPress={() => remove(entry.id)}
                      style={styles.removeBtn}
                      accessibilityLabel="Remove entry"
                    >
                      <TText variant="small" color="secondary">✕</TText>
                    </Pressable>
                  </View>
                ))
              )}
            </Animated.View>
          );
        })}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Food picker modal */}
      <Modal visible={pickerVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.pickerSafe}>
          <View style={styles.pickerHeader}>
            <TText variant="heading">Add to {selectedMeal}</TText>
            <Pressable onPress={() => setPickerVisible(false)}>
              <TText color="secondary">✕</TText>
            </Pressable>
          </View>
          <FlatList
            data={FOOD_PRESETS}
            keyExtractor={item => item.name}
            contentContainerStyle={styles.presetList}
            renderItem={({ item }) => (
              <Pressable style={styles.presetItem} onPress={() => handleAdd(item)}>
                <View style={styles.presetInfo}>
                  <TText variant="body">{item.name}</TText>
                  <TText variant="small" color="secondary">
                    {item.calories}kcal · P:{item.protein}g · {item.servingSize}
                  </TText>
                </View>
                <TText style={styles.presetAdd}>+</TText>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: 120 },
  ringCard: { padding: spacing[4], gap: spacing[3] },
  rings: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  fatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proteinBadge: { color: colors.success, fontWeight: '600', backgroundColor: `${colors.success}15`, paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  mealSection: { gap: spacing[2] },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  mealTitle: { flex: 1, textTransform: 'capitalize' },
  addMealBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addMealIcon: { color: '#fff', fontSize: 20, lineHeight: 24, fontWeight: '300' },
  emptyMeal: { backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: spacing[3], alignItems: 'center' },
  emptyMealText: { fontStyle: 'italic' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: colors.surface, borderRadius: 10, padding: spacing[3] },
  entryInfo: { flex: 1, gap: 2 },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  pickerSafe: { flex: 1, backgroundColor: colors.background },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  presetList: { padding: spacing[3], gap: spacing[2] },
  presetItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.surface, borderRadius: 12, padding: spacing[3] },
  presetInfo: { flex: 1, gap: 2 },
  presetAdd: { fontSize: 22, color: colors.accent, fontWeight: '300' },
});
