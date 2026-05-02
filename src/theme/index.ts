import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  globalCss: {
    'html, body': {
      bg: 'bg',
      color: 'fg',
      fontFamily: 'body',
      fontWeight: 'medium',
      textRendering: 'optimizeLegibility',
      minHeight: '100vh',
      overscrollBehavior: 'none',
    },
    '*::selection': {
      bg: 'accent.solid',
      color: 'navy.950',
    },
    'button, [role="button"]': {
      minHeight: 'touchTarget',
      minWidth: 'touchTarget',
    },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: '"Inter", "Segoe UI", system-ui, sans-serif' },
        body: { value: '"Inter", "Segoe UI", system-ui, sans-serif' },
        mono: { value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      },
      fontWeights: {
        normal: { value: '500' },
        medium: { value: '600' },
        semibold: { value: '700' },
        bold: { value: '800' },
        extrabold: { value: '900' },
      },
      fontSizes: {
        xs: { value: '0.875rem' },
        sm: { value: '1rem' },
        md: { value: '1.125rem' },
        lg: { value: '1.25rem' },
        xl: { value: '1.5rem' },
        '2xl': { value: '1.875rem' },
        '3xl': { value: '2.25rem' },
        '4xl': { value: '3rem' },
        '5xl': { value: '3.75rem' },
      },
      lineHeights: {
        shorter: { value: '1.2' },
        short: { value: '1.35' },
        base: { value: '1.5' },
        tall: { value: '1.65' },
      },
      letterSpacings: {
        tight: { value: '-0.02em' },
        normal: { value: '0' },
        wide: { value: '0.02em' },
      },
      sizes: {
        touchTarget: { value: '56px' },
        touchTargetLg: { value: '72px' },
        touchTargetXl: { value: '96px' },
      },
      radii: {
        sm: { value: '6px' },
        md: { value: '10px' },
        lg: { value: '16px' },
        xl: { value: '24px' },
        '2xl': { value: '32px' },
        full: { value: '9999px' },
      },
      colors: {
        navy: {
          50: { value: '#E6EBF2' },
          100: { value: '#C0CCDC' },
          200: { value: '#96AAC3' },
          300: { value: '#6C87A9' },
          400: { value: '#4D6E97' },
          500: { value: '#2F5586' },
          600: { value: '#1F3F6B' },
          700: { value: '#142C50' },
          800: { value: '#0B1E3A' },
          900: { value: '#06122A' },
          950: { value: '#030A1A' },
        },
        amber: {
          50: { value: '#FFF8E1' },
          100: { value: '#FFECB3' },
          200: { value: '#FFE082' },
          300: { value: '#FFD54F' },
          400: { value: '#FFCA28' },
          500: { value: '#FFB300' },
          600: { value: '#FFA000' },
          700: { value: '#FF8F00' },
          800: { value: '#FF6F00' },
          900: { value: '#E65100' },
        },
        signal: {
          success: { value: '#22C55E' },
          warning: { value: '#FACC15' },
          danger: { value: '#EF4444' },
          info: { value: '#3B82F6' },
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: { _light: '{colors.white}', _dark: '{colors.navy.900}' } },
          subtle: { value: { _light: '{colors.gray.50}', _dark: '{colors.navy.800}' } },
          muted: { value: { _light: '{colors.gray.100}', _dark: '{colors.navy.700}' } },
          panel: { value: { _light: '{colors.white}', _dark: '{colors.navy.800}' } },
          inverted: { value: { _light: '{colors.navy.900}', _dark: '{colors.white}' } },
        },
        fg: {
          DEFAULT: { value: { _light: '{colors.navy.900}', _dark: '{colors.white}' } },
          muted: { value: { _light: '{colors.gray.700}', _dark: '{colors.navy.100}' } },
          subtle: { value: { _light: '{colors.gray.500}', _dark: '{colors.navy.200}' } },
          inverted: { value: { _light: '{colors.white}', _dark: '{colors.navy.950}' } },
        },
        border: {
          DEFAULT: { value: { _light: '{colors.gray.200}', _dark: '{colors.navy.700}' } },
          emphasized: { value: { _light: '{colors.gray.400}', _dark: '{colors.navy.500}' } },
        },
        accent: {
          solid: { value: { _light: '{colors.amber.600}', _dark: '{colors.amber.500}' } },
          contrast: { value: '{colors.navy.950}' },
          fg: { value: { _light: '{colors.amber.700}', _dark: '{colors.amber.400}' } },
          muted: { value: { _light: '{colors.amber.100}', _dark: '{colors.amber.800}' } },
          subtle: { value: { _light: '{colors.amber.50}', _dark: '{colors.amber.900}' } },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
