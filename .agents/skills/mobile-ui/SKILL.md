---
name: mobile-ui
description: Improve or review the Lost & Found React Native mobile app's screens, navigation, accessibility, and user flows, with appropriate visual and functional checks. Use for mobile UI work in this repository; not for the admin web app or API-only changes.
metadata:
  author: "Lost & Found Project"
  version: "1.0.0"
---

# Mobile UI work

Work in `mobile/`. The app uses Expo, React Native, React Navigation, and the providers in `mobile/App.js`. Read the affected screen, its entry in `mobile/src/navigation/AppNavigator.js`, and related components before changing it. Keep its existing data contract intact unless the user also requests behavior changes.

For each requested change:

1. Identify the user task and the screen states it needs: initial, loading, empty, error, success, and permission denied where relevant. Prioritize the requested flow instead of redesigning unrelated screens.
2. Make the layout coherent with nearby screens. Reuse existing interaction patterns, spacing, typography, and colors where they work; improve inconsistencies that affect the flow. Avoid adding a UI package for a change that React Native can handle cleanly.
3. Keep controls usable on small screens and with the keyboard open. Check labels, contrast, readable text, touch targets, navigation back behavior, and platform safe areas. Preserve the options from `mobile/src/context/AccessibilityContext.js`: font scaling, high contrast, larger touch targets, reduced motion, and speech where the flow already uses them.
4. Connect every visible action to real behavior or clearly identify it as unavailable. Check form validation, disabled and submitting states, repeated taps, feedback after success or failure, and return navigation. Avoid decorative controls that appear functional but do nothing.
5. Verify the changed flow at the strongest practical level. Run the mobile config or bundling check relevant to the edit, then exercise the flow in an emulator or device when available. Inspect the rendered screen at normal and larger text sizes and in high contrast when those settings apply. If runtime access is unavailable, report precisely what was checked and what still needs a device check.

When reporting the result, name the screens changed, the behavior checked, and any remaining device or backend dependency. Do not claim functionality from a successful Expo config read alone.