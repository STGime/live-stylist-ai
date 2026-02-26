import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import type { Occasion } from '../types';

interface OccasionPickerProps {
  selected: Occasion | null;
  onSelect: (occasion: Occasion | null) => void;
}

const OCCASIONS: { key: Occasion; emoji: string; label: string }[] = [
  { key: 'casual', emoji: '👟', label: 'Casual' },
  { key: 'work', emoji: '💼', label: 'Work' },
  { key: 'date_night', emoji: '🌹', label: 'Date Night' },
  { key: 'event', emoji: '🎉', label: 'Event' },
  { key: 'going_out', emoji: '🍸', label: 'Going Out' },
  { key: 'selfcare', emoji: '🧖', label: 'Self-Care' },
];

export default function OccasionPicker({ selected, onSelect }: OccasionPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>What's the occasion?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {OCCASIONS.map(({ key, emoji, label }) => {
          const isSelected = selected === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onSelect(isSelected ? null : key)}
              style={[styles.pill, isSelected && styles.pillSelected]}
              activeOpacity={0.7}>
              <Text style={styles.emoji}>{emoji}</Text>
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMid,
    marginBottom: 8,
  },
  scroll: {
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 50,
    backgroundColor: COLORS.pinkSoft,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pillSelected: {
    backgroundColor: COLORS.pinkPale,
    borderColor: COLORS.pink,
  },
  emoji: {
    fontSize: 14,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMid,
  },
  pillTextSelected: {
    color: COLORS.pink,
  },
});
