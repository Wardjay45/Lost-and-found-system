import React, { forwardRef } from 'react';
import { TouchableOpacity as NativeTouchableOpacity, Switch as NativeSwitch, TextInput as NativeTextInput } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { cleanSpokenLabel, textFromChildren } from '../services/speech.mjs';

export const TouchableOpacity = forwardRef(function SpokenTouchable({ onPress, children, accessibilityLabel, speechFeedback = true, disabled, ...props }, ref) {
  const { speak, accessibilityStyles } = useAccessibility();
  const label = cleanSpokenLabel(accessibilityLabel || textFromChildren(children));
  return (
    <NativeTouchableOpacity {...props} ref={ref} disabled={disabled} accessibilityRole={props.accessibilityRole || 'button'}
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      style={[props.style, { minHeight: 44, minWidth: 44 }, accessibilityStyles?.touch]}
      accessibilityLabel={accessibilityLabel || label || undefined} onPress={event => {
      if (disabled) return;
      if (speechFeedback && label) speak(label);
      return onPress?.(event);
    }}>
      {children}
    </NativeTouchableOpacity>
  );
});

export const Switch = forwardRef(function SpokenSwitch({ onValueChange, accessibilityLabel, disabled, ...props }, ref) {
  const { speak } = useAccessibility();
  return <NativeSwitch {...props} ref={ref} disabled={disabled} accessibilityLabel={accessibilityLabel} onValueChange={value => {
    if (disabled) return;
    const result = onValueChange?.(value);
    if (accessibilityLabel) speak(cleanSpokenLabel(accessibilityLabel) + (value ? ' on' : ' off'));
    return result;
  }} />;
});

export const TextInput = forwardRef(function SpokenInput({ onFocus, accessibilityLabel, placeholder, ...props }, ref) {
  const { speak } = useAccessibility();
  const label = cleanSpokenLabel(accessibilityLabel || placeholder || (props.secureTextEntry ? 'Password' : 'Text input'));
  return <NativeTextInput {...props} ref={ref} placeholder={placeholder} accessibilityLabel={accessibilityLabel || label} onFocus={event => {
    speak(label + ' field');
    return onFocus?.(event);
  }} />;
});
