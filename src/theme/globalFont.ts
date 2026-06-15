// ── Global Montserrat enforcement ──────────────────────────────────────────────
// Design-only helper. Makes every <Text> / <TextInput> in the app render in
// Montserrat without having to edit each screen.
//
// The Montserrat font files are loaded once in App.tsx (useFonts). This module
// patches the default render of React Native's Text and TextInput so that any
// text that does NOT explicitly pick its own custom font family inherits
// Montserrat — choosing the correct weight-specific Montserrat file so bold /
// semibold text stays crisp on both web and native.
//
// It changes ONLY the font family/weight resolution. Colors, sizes, spacing,
// layout, logic, navigation and data are all untouched.

import { Text, TextInput, StyleSheet } from 'react-native';

// Maps a numeric/string fontWeight to the matching Montserrat file that is
// already registered in App.tsx via useFonts().
const familyForWeight = (weight?: string | number): string => {
  switch (String(weight)) {
    case '100':
    case '200':
    case '300':
      return 'Montserrat-Light';
    case '500':
      return 'Montserrat-Medium';
    case '600':
      return 'Montserrat-SemiBold';
    case '700':
    case 'bold':
      return 'Montserrat-Bold';
    case '800':
    case '900':
      return 'Montserrat-ExtraBold';
    case '400':
    case 'normal':
    default:
      return 'Montserrat';
  }
};

const patchComponent = (Component: any) => {
  if (!Component || Component.__montserratPatched) return;
  const originalRender = Component.render;
  if (typeof originalRender !== 'function') return;

  Component.__montserratPatched = true;
  Component.render = function (props: any, ref: any) {
    const flat = StyleSheet.flatten(props?.style) || {};
    const family = flat.fontFamily;

    // Only inject for text that has no explicit font, or that already uses the
    // generic "Montserrat" family — so we never override a deliberate custom
    // font choice, but we DO upgrade generic Montserrat to the right weight file.
    const shouldInject = !family || family === 'Montserrat';
    if (!shouldInject) {
      return originalRender.call(this, props, ref);
    }

    const injected = {
      fontFamily: familyForWeight(flat.fontWeight),
      // We've already encoded the weight in the font file, so reset the numeric
      // weight to avoid faux-bold synthesis on web / double weighting on native.
      fontWeight: 'normal' as const,
    };

    // Injected style goes LAST so the resolved family/weight wins; every other
    // declared style (color, size, spacing, …) is preserved as-is.
    const nextProps = { ...props, style: [props?.style, injected] };
    return originalRender.call(this, nextProps, ref);
  };
};

// Apply once at import time.
patchComponent(Text as any);
patchComponent(TextInput as any);

export {};
