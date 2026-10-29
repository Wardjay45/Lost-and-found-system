import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { useAccessibility } from '../context/AccessibilityContext';

export default function FormIcon({ name, size = 20, color, style }) {
  const { themeColors, scaledFontSize } = useAccessibility();
  return (
    <Feather
      name={name}
      size={scaledFontSize(size)}
      color={color || themeColors.muted}
      style={style}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    />
  );
}
