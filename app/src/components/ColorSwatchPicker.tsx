import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SWATCHES, COLORS } from '../theme/colors';

interface Props {
  selected: string | null;
  onSelect: (name: string) => void;
  size?: number;
}

export default function ColorSwatchPicker({ selected, onSelect, size = 44 }: Props) {
  return (
    <View style={styles.container}>
      {SWATCHES.map(swatch => {
        const isSelected = selected === swatch.name;
        return (
          <TouchableOpacity
            key={swatch.name}
            onPress={() => onSelect(swatch.name)}
            activeOpacity={0.7}
            style={[
              styles.swatch,
              {
                width: size,
                height: size,
                backgroundColor: swatch.color,
                borderWidth: isSelected ? 3 : 0,
                borderColor: COLORS.pink,
                transform: [{ scale: isSelected ? 1.12 : 1 }],
              },
            ]}>
            {isSelected && (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6L9 17L4 12"
                  stroke="white"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  swatch: {
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 3,
  },
});
