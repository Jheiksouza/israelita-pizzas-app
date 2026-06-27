---
name: Electric Crust
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#d4c0d7'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#9d8ba0'
  outline-variant: '#514255'
  surface-tint: '#ecb2ff'
  primary: '#ecb2ff'
  on-primary: '#520071'
  primary-container: '#bd00ff'
  on-primary-container: '#ffffff'
  inverse-primary: '#9900cf'
  secondary: '#d3fbff'
  on-secondary: '#00363a'
  secondary-container: '#00eefc'
  on-secondary-container: '#00686f'
  tertiary: '#ffb59a'
  on-tertiary: '#5a1b00'
  tertiary-container: '#cf4900'
  on-tertiary-container: '#fffeff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f8d8ff'
  primary-fixed-dim: '#ecb2ff'
  on-primary-fixed: '#320047'
  on-primary-fixed-variant: '#74009f'
  secondary-fixed: '#7df4ff'
  secondary-fixed-dim: '#00dbe9'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f54'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#802a00'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 64px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Montserrat
    fontSize: 40px
    fontWeight: '900'
    lineHeight: '1.1'
  headline-md:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Montserrat
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Montserrat
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-bold:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  caption:
    fontFamily: Montserrat
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 80px
  container-max: 1280px
---

## Brand & Style
The design system focuses on a high-energy, premium digital experience that reinvents the pizza-ordering ritual for a contemporary audience. Moving away from rustic "trattoria" tropes, this system embraces a **Neon-Glassmorphism** aesthetic. The personality is bold, nocturnal, and technologically sophisticated. 

The visual language utilizes deep background blurs, vibrant color glows, and translucent layers to create a sense of depth and culinary "magic." It targets a demographic that values convenience and aesthetics, positioning pizza as a premium, curated lifestyle choice rather than a generic commodity.

## Colors
This design system operates exclusively in a dark-mode environment to maximize the impact of the energetic gradients. The palette is built on "Electric Purple" and "Hyper Teal" to create a high-contrast, futuristic feel.

- **Primary (--primary):** #BD00FF (Electric Purple) - Used for primary actions and brand highlights.
- **Secondary (--secondary):** #00F0FF (Neon Teal) - Used for emphasis, accents, and success states.
- **Tertiary (--accent):** #FF5C00 (Vibrant Orange) - Used sparingly for "hot" items, promotions, or upsells.
- **Background (--bg-main):** #0A0A0C - A deep, near-black neutral that allows glass elements to pop.
- **Surface (--bg-card):** rgba(255, 255, 255, 0.05) - The base for glassmorphic elements.

## Typography
The system uses **Montserrat** across all levels to maintain a geometric, clean, and rhythmic feel. High-weight headers (Bold and Black) are essential to the "Bold" aesthetic, creating a strong hierarchy against the soft glass backgrounds.

For "Display" roles, use uppercase styling with tight letter spacing to evoke a premium editorial look. Body text should maintain a generous line height (1.6) to ensure readability against dark, translucent backgrounds.

## Layout & Spacing
The layout follows a fluid 12-column grid for desktop and a single-column layout for mobile. A strict 8px spacing rhythm ensures consistency. 

- **Outer Margins:** Use 20px on mobile to maximize screen real estate, increasing to 80px on desktop for a premium, spacious feel.
- **Section Spacing:** Generous vertical padding (80px - 120px) should be used between homepage sections to allow the background "glows" to breathe.
- **Card Grids:** Use a 24px gutter to provide clear separation between glassmorphic components.

## Elevation & Depth
Depth is the cornerstone of this design system. It is achieved through three primary techniques:

1.  **Backdrop Blur:** All cards and modals must use a `backdrop-filter: blur(20px)` combined with a semi-transparent white or primary-tinted stroke (0.5px or 1px).
2.  **Inner Glows:** Buttons and active states utilize a subtle inner box-shadow to simulate light-catching edges of glass.
3.  **Deep Ambient Shadows:** Use multi-layered shadows with low opacity (e.g., `0 20px 40px rgba(0,0,0,0.4)`) to lift glass panels off the background.
4.  **Floating Orbs:** Background "blobs" of blurred primary and secondary colors should move slowly behind the UI, creating a dynamic, immersive environment.

## Shapes
The shape language is friendly but structured. We utilize generous rounded corners to soften the high-tech aesthetic.

- **Base Radius (8px):** Used for small interactive elements like checkboxes and inputs.
- **Standard Radius (16px / --radius-lg):** The default for all product cards, menu items, and containers.
- **Full Radius (Pill):** Used for tags, badges, and primary call-to-action buttons to make them feel "squishy" and tactile.

## Components
### Buttons
Primary buttons should be styled as high-contrast gradients (Purple to Teal) with a white label. Apply a `box-shadow` that matches the gradient color to create a "glow" effect. On hover, the glow should intensify.

### Cards (Pizza/Menu Items)
Cards use the glassmorphism style: a 5% white fill, 20px backdrop blur, and a 1px white border at 10% opacity. Imagery should be high-quality, high-contrast, and "pop" out of the card boundaries (overflow-visible) when possible.

### Inputs & Selects
Dark fields with a subtle stroke. On focus, the border color transitions to the primary gradient, and a soft glow is applied to the entire input field.

### Progress & Loading
Use animated gradients. The "Order Tracking" component should utilize the Hyper Teal color for a "high-tech" radar or pulse effect.

### Chips/Tags
Small pill-shaped elements used for dietary labels (e.g., "Spicy", "Vegan"). Use a semi-transparent background color corresponding to the tag's meaning, but keep the text white for readability.