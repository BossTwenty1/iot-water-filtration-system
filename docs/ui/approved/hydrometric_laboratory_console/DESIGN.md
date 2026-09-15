---
name: HydroMetric Laboratory Console
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3f4850'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#006591'
  on-secondary: '#ffffff'
  secondary-container: '#39b8fd'
  on-secondary-container: '#004666'
  tertiary: '#006947'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855b'
  on-tertiary-container: '#f5fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  telemetry-xl:
    fontFamily: JetBrains Mono
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.03em
  telemetry-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.02em
  telemetry-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-xs:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system serves an IoT-connected laboratory filtration research console powered by an ESP32-WROOM-32 embedded controller. The interface communicates rigorous empirical accuracy, technical discipline, and clear data observability for academic researchers and lab engineers.

The visual style blends **Technical Minimalism** with a **Scientific Instrument Aesthetic**:
- Utilitarian precision prioritizing live sensor readouts, continuous differential telemetry, and schematic process tracking over decorative embellishments.
- High visual legibility under sterile laboratory fluorescent lighting and varied benchtop display setups.
- Professional neutrality: metric changes and operating states must avoid hyper-gamified status flags, relying strictly on standardized laboratory verification terminology.
- Structured technical composure: modular data enclosures, sharp borders, and monospaced telemetry blocks reflecting embedded microcontroller output accuracy.

## Colors

The system uses a pure light mode derived from scientific lab environments and water analytical tech.

### Functional Roles
- **Canvas & Surface Architecture:** Base canvas is set to `#faf8ff`, elevated cards use pure `#ffffff`, and nested telemetry containers use `#f1f5f9`.
- **Structural Outlines:** `#e2e8f0` for primary module boundaries; `#cbd5e1` for dividing metrics and active data grids.
- **Primary & Accent Blue (Hydro-Tech):** `#0284c7` (primary action/emphasis) and `#0ea5e9` (telemetry accent, stream paths, and current status highlights).
- **Operational & Status States:**
  - Active / Sensor Online / No Sensor Fault: Emerald Green (`#10b981`).
  - Threshold Pending / Calibration Warning: Lab Amber (`#f59e0b`).
  - Inactive / Reading Available / Monitoring: Neutral Slate (`#64748b`).
- **Typography & Labels:** Primary telemetry values and technical headings use deep slate `#0f172a`, while secondary descriptive metadata uses `#475569`.

## Typography

Typography establishes an unambiguous division between structural interface elements and telemetry readouts:
- **Hanken Grotesk** is reserved for navigational headers, module identifiers, parameter labels, and structural UI interactions. Its clean geometric sans-serif form offers immediate readability at all scales.
- **JetBrains Mono** governs all raw ESP32-WROOM-32 metrics, timestamps, status values, and physical process annotations. Its fixed-width character grid guarantees alignment across pre-filtration and post-filtration parameter tables (pH, NTU, ppm, °C, L/min, L).
- All technical sensor labels must be set in uppercase (`label-sm` or `label-xs`) with deliberate letter spacing for clarity.

## Layout & Spacing

The layout is built around a structured 12-column fluid grid, tailored to benchtop laboratory monitoring screens and mobile audit panels.

### Layout Principles
- **Global Rhythm:** Built strictly in 4px and 8px baseline intervals (`0.25rem` to `2rem`).
- **Physical Schematic Flow:** Process-flow blocks mirror the confirmed path (`Water Source -> Booster Pump -> Pre-Filtration Sensors -> Ultrafiltration -> UV-C -> Post-Filtration Sensors -> Output`) in a top-level horizontal pipeline on desktop, reflowing into an aligned vertical stepper on narrow viewports.
- **Dual Telemetry Grid:** Pre-filtration and post-filtration sensor modules sit side-by-side on desktop displays (6 columns each) to facilitate instantaneous delta evaluation across pH, Turbidity (NTU), TDS (ppm), Temperature (°C), Flow Rate (L/min), and Total Volume (L).
- **Responsive Adaptations:**
  - **Desktop (>=1024px):** 12 columns, 1.5rem canvas margins, persistent system status toolbar.
  - **Tablet (768px - 1023px):** 8 columns, 1rem canvas margins, stacked pre/post comparisons with synchronized timestamps.
  - **Mobile (<768px):** 4 columns, single-column metric stacks with tabbed sensor array toggles.

## Elevation & Depth

This design system completely avoids ambient dropshadows or heavy blur filters in favor of **Crisp Technical Boundaries** and **Tonal Tiers**:
- **Layer 0 (Canvas):** Base background `#faf8ff`.
- **Layer 1 (Modular Instrument Panels):** Solid `#ffffff` background with 1px structural borders of `#e2e8f0`.
- **Layer 2 (Embedded Sensor Readouts):** Nested container background `#f1f5f9` inset inside instrument cards, framed with 1px `#cbd5e1` to denote dedicated microcontroller telemetry capture areas.
- **Interactive Focus & Hover:** No floating elevation; instead, focused or active elements swap their border to `#0284c7` or `#0ea5e9` with an optional crisp 1px ring outline.

## Shapes

The design uses **Soft (0.25rem / 4px)** geometry (`roundedness: 1`).

- Standard cards, buttons, nested telemetry cells, and status badges use `0.25rem` corners to evoke physical laboratory equipment chassis and modular PCB enclosures.
- Stage-indicator pills and connection status dots may use complete circular radii, but all structural containers remain cleanly squared with minimal corner smoothing.

## Components

### 1. Telemetry Display Modules
- **Container:** Background `#ffffff`, border 1px solid `#e2e8f0`, radius `0.25rem`, padding `space-md`.
- **Parameter Header:** Parameter name in `label-sm` (`Hanken Grotesk`, neutral `#475569`, uppercase) alongside confirmed engineering unit (`JetBrains Mono`, `#64748b`).
- **Telemetry Value:** Formatted via `telemetry-xl` or `telemetry-lg` in `JetBrains Mono` bold (`#0f172a`).
- **Nested Differential Well:** Pre-vs-Post comparative metric rendered in `#f1f5f9` with 1px `#cbd5e1` border.

### 2. Status Chips & Badges
- **Allowed States:** Strictly limited to neutral laboratory terms: `Monitoring`, `Reading Available`, `Threshold Pending`, `Sensor Online`, `No Sensor Fault`, `Laboratory Validation Pending`.
- **Format:** Micro-padding (`space-xs` vertical, `space-sm` horizontal), 1px solid border, font `label-xs` (`JetBrains Mono`).
- **State Styling:**
  - `Sensor Online` / `No Sensor Fault`: Background `#f0fdf4`, text `#15803d`, border `#bbf7d0`.
  - `Threshold Pending`: Background `#fffbeb`, text `#b45309`, border `#fde68a`.
  - `Monitoring` / `Reading Available` / `Laboratory Validation Pending`: Background `#f8fafc`, text `#475569`, border `#cbd5e1`.

### 3. Physical Flow Schematic Tracker
- Inline graphical node chain: `Water Source` → `Booster Pump` → `Pre-Filtration Sensors` → `Ultrafiltration` → `UV-C` → `Post-Filtration Sensors` → `Output`.
- Nodes are rectangular tags (`0.25rem` radius) linked by 2px solid connective lines in `#cbd5e1` (or `#0284c7` during dynamic throughput).

### 4. Buttons & Controls
- **Primary Action (Data Log / Stream Hold):** Solid `#0284c7` fill, text `#ffffff` (`Hanken Grotesk`, medium), 1px border `#0369a1`.
- **Secondary Action (Recalibrate Display / Reset Totalizer):** Surface `#ffffff`, border 1px solid `#cbd5e1`, text `#334155`. Hover shifts border to `#0ea5e9`.

### 5. Data Tables (Parameter Array)
- Dedicated rows for the six confirmed parameters:
  1. pH
  2. Turbidity (NTU)
  3. TDS (ppm)
  4. Temperature (°C)
  5. Flow Rate (L/min)
  6. Total Processed Water Volume (L)
- Header row styled in `label-xs` over `#f1f5f9`. Row heights locked to 40px with alternating row highlights and hairline `#e2e8f0` dividers.
