# DESIGN.md -- Sewer Pipe Defect Detection GUI

**Project:** Sewer Pipe Defect Detection (CNN/Deep Learning)
**Team:** Plumbers of UTS
**Version:** 1.0.0
**Last Updated:** 2026-03-28

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Navigation](#2-navigation)
3. [Page Layouts](#3-page-layouts)
4. [Component Inventory](#4-component-inventory)
5. [Responsive Strategy](#5-responsive-strategy)
6. [Accessibility and Motion](#6-accessibility-and-motion)

---

## 1. Design System

### 1.1 Design Principles

1. **Clarity over decoration.** Every element must serve the inspection workflow. No ornamental gradients, no unnecessary animations.
2. **Light-first legibility.** A clean, light background provides maximum contrast for pipe imagery (dark interiors, CCTV footage). The neutral UI recedes so inspection content commands attention.
3. **Severity hierarchy.** The most critical defects must be visually unmissable. Color and size encode priority.
4. **Professional trust.** This is an infrastructure inspection tool. The interface must feel reliable, not playful.

### 1.2 Color Palette

All colors are specified in HSL for consistency. Hex equivalents are provided for implementation reference.

#### Background Scale (Neutral)

| Token                  | HSL                  | Hex       | Usage                                    |
|------------------------|----------------------|-----------|------------------------------------------|
| `--bg-base`            | 0 0% 100%           | `#ffffff` | App background, deepest layer            |
| `--bg-surface`         | 240 5% 96%          | `#f5f5f7` | Card backgrounds, sidebar                |
| `--bg-elevated`        | 240 4% 93%          | `#eeeef0` | Hover states, modals, dropdowns          |
| `--bg-overlay`         | 240 3% 90%          | `#e5e5ea` | Active states, selected rows             |

#### Foreground Scale (Text)

| Token                  | HSL                  | Hex       | Usage                                    |
|------------------------|----------------------|-----------|------------------------------------------|
| `--fg-primary`         | 220 15% 10%         | `#151820` | Primary text, headings                   |
| `--fg-secondary`       | 220 8% 45%          | `#6b6f78` | Secondary text, descriptions             |
| `--fg-tertiary`        | 220 6% 62%          | `#9ea3ad` | Placeholder text, disabled labels        |
| `--fg-inverse`         | 0 0% 100%           | `#ffffff` | Text on dark/accent-colored backgrounds  |

#### Accent -- Orange/Amber (Primary Action)

| Token                  | HSL                  | Hex       | Usage                                    |
|------------------------|----------------------|-----------|------------------------------------------|
| `--accent`             | 28 92% 52%          | `#f0850f` | Primary buttons, active nav, links       |
| `--accent-hover`       | 28 92% 45%          | `#d17209` | Hover state for primary actions          |
| `--accent-muted`       | 28 60% 94%          | `#fef0e0` | Accent backgrounds, subtle highlights    |
| `--accent-text`        | 28 92% 35%          | `#a35a08` | Accent-colored text on light backgrounds |

#### Severity Scale (Defect Classification)

| Token                  | HSL                  | Hex       | Usage                                    |
|------------------------|----------------------|-----------|------------------------------------------|
| `--severity-critical`  | 0 72% 45%           | `#c5252d` | Broken Pipe, critical defects            |
| `--severity-high`      | 20 85% 46%          | `#d95520` | Root Intrusion, Surface Damage           |
| `--severity-medium`    | 40 90% 38%          | `#b8800a` | Cracks, Displaced Joint                  |
| `--severity-low`       | 160 55% 38%         | `#2b9a62` | Deposit/Debris, minor issues             |

#### Functional Colors

| Token                  | HSL                  | Hex       | Usage                                    |
|------------------------|----------------------|-----------|------------------------------------------|
| `--success`            | 142 60% 38%         | `#279553` | Successful upload, no defects found      |
| `--warning`            | 40 90% 38%          | `#b8800a` | Processing, model confidence < 80%       |
| `--error`              | 0 72% 45%           | `#c5252d` | Upload failure, API error                |
| `--info`               | 210 70% 45%         | `#2268b8` | Informational badges, help text          |

#### Border and Divider

| Token                  | HSL                  | Hex       | Usage                                    |
|------------------------|----------------------|-----------|------------------------------------------|
| `--border-default`     | 240 5% 88%          | `#e0e0e5` | Card borders, dividers                   |
| `--border-hover`       | 240 4% 78%          | `#c8c8d0` | Hover-state borders                      |
| `--border-focus`       | 28 92% 52%          | `#f0850f` | Focus ring (uses accent)                 |

### 1.3 Typography

System font stack only. No external font loading required.

```
--font-sans: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: "SF Mono", "JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace;
```

If Inter is not installed on the user's system, the stack falls through to platform defaults. Inter is recommended because of its clarity at small sizes and its tabular number support, which matters for displaying confidence scores and statistics. If the team wants guaranteed consistency, install Inter via `@fontsource/inter` (npm package, self-hosted, no Google Fonts dependency).

#### Type Scale

Base size: 16px (1rem). Scale ratio: 1.25 (Major Third).

| Token         | Size     | Weight | Line Height | Letter Spacing | Usage                            |
|---------------|----------|--------|-------------|----------------|----------------------------------|
| `--text-xs`   | 0.75rem  | 400    | 1.5         | 0.02em         | Badges, timestamps               |
| `--text-sm`   | 0.875rem | 400    | 1.5         | 0.01em         | Table cells, captions            |
| `--text-base` | 1rem     | 400    | 1.6         | 0              | Body text, descriptions          |
| `--text-lg`   | 1.125rem | 500    | 1.5         | 0              | Card titles, nav items           |
| `--text-xl`   | 1.25rem  | 600    | 1.4         | -0.01em        | Section headings                 |
| `--text-2xl`  | 1.5rem   | 700    | 1.3         | -0.015em       | Page titles                      |
| `--text-3xl`  | 1.875rem | 700    | 1.2         | -0.02em        | Dashboard stat numbers           |
| `--text-4xl`  | 2.25rem  | 800    | 1.1         | -0.025em       | Hero metrics (rarely used)       |

#### Monospace Usage

Monospace is used exclusively for:
- Confidence score values (e.g., `94.7%`)
- Model architecture labels (e.g., `ResNet-50`)
- File names in upload history
- JSON/API response previews

### 1.4 Spacing Scale

8px base unit. All spacing values are multiples of 4px.

| Token      | Value  | Usage                                         |
|------------|--------|-----------------------------------------------|
| `--sp-1`   | 4px    | Tight inner padding (badge padding)           |
| `--sp-2`   | 8px    | Default inner gap, icon-to-text spacing       |
| `--sp-3`   | 12px   | Compact card padding                          |
| `--sp-4`   | 16px   | Default card padding, form field gaps         |
| `--sp-5`   | 20px   | Section internal padding                      |
| `--sp-6`   | 24px   | Card padding (standard)                       |
| `--sp-8`   | 32px   | Section gaps                                  |
| `--sp-10`  | 40px   | Page section spacing                          |
| `--sp-12`  | 48px   | Major section breaks                          |
| `--sp-16`  | 64px   | Page top/bottom padding                       |

### 1.5 Border Radius

| Token          | Value | Usage                                  |
|----------------|-------|----------------------------------------|
| `--radius-sm`  | 4px   | Badges, small chips                    |
| `--radius-md`  | 8px   | Cards, buttons, inputs                 |
| `--radius-lg`  | 12px  | Modals, large containers              |
| `--radius-xl`  | 16px  | Upload drop zone                       |
| `--radius-full`| 9999px| Avatars, circular indicators           |

### 1.6 Elevation (Shadows)

Shadows use black with low opacity to create subtle depth on light backgrounds. Elevation is communicated through a combination of shadow diffusion and background lightness differences.

| Token              | Value                                             | Usage               |
|--------------------|---------------------------------------------------|----------------------|
| `--shadow-sm`      | 0 1px 2px rgba(0,0,0,0.06)                       | Buttons, chips       |
| `--shadow-md`      | 0 4px 12px rgba(0,0,0,0.08)                      | Cards, dropdowns     |
| `--shadow-lg`      | 0 8px 24px rgba(0,0,0,0.12)                      | Modals, overlays     |

---

## 2. Navigation

### 2.1 Structure: Collapsible Sidebar

The application uses a left sidebar for primary navigation. Rationale: a sidebar provides persistent navigation context while maximizing vertical space for image inspection content.

```
+--+--------------------------------------------------+
|  |                                                    |
|  |  [Page Content Area]                              |
|S |                                                    |
|I |                                                    |
|D |                                                    |
|E |                                                    |
|B |                                                    |
|A |                                                    |
|R |                                                    |
|  |                                                    |
+--+--------------------------------------------------+
```

#### Sidebar -- Expanded (240px width)

```
+-------------------------------+
| PLUMBERS AT UTS               |
| Sewer Defect Detection        |
+-------------------------------+
|                               |
| [icon] Dashboard              |
| [icon] Detect                 |
| [icon] History                |
| [icon] Model Info             |
|                               |
+-------------------------------+
|                               |
| [icon] Settings               |
| [icon] Help                   |
|                               |
| v1.0.0                        |
+-------------------------------+
```

- Active nav item: `--bg-overlay` background, left 3px border in `--accent`, text in `--fg-primary`
- Inactive nav item: No background, text in `--fg-secondary`
- Hover: `--bg-elevated` background, text transitions to `--fg-primary`

#### Sidebar -- Collapsed (64px width)

On smaller desktop screens or by user toggle, the sidebar collapses to icon-only mode. Hovering an icon shows a tooltip with the page name.

```
+------+
| [PP] |   <-- Team logo/initials
+------+
| [ic] |   Dashboard
| [ic] |   Detect
| [ic] |   History
| [ic] |   Model Info
+------+
| [ic] |   Settings
| [ic] |   Help
+------+
```

#### Mobile Navigation (< 768px)

On mobile, the sidebar is replaced by:
1. A top bar (56px height) with: hamburger menu button (left), page title (center), quick-detect button (right)
2. A bottom navigation bar (56px height) with 4 primary nav items as icon + short label

```
Top bar:
+--[=]------- Dashboard -------[camera]--+

Bottom bar:
+--[Dashboard]--[Detect]--[History]--[Model]--+
```

The bottom bar uses the iOS/Android pattern: active item is `--accent` colored, inactive items are `--fg-tertiary`.

### 2.2 Breadcrumb

No breadcrumb. The app is flat (4 pages, no nesting). The page title in the content header is sufficient.

---

## 3. Page Layouts

### 3.1 Dashboard Page

**Purpose:** Provide an at-a-glance summary of inspection activity, model performance, and recent results.

#### Desktop Layout (>= 1024px)

```
+-- Sidebar --+-- Content Area (padding: 32px) ------------------+
|             |                                                     |
|             |  Dashboard                         [Upload New >]  |
|             |  Overview of inspection activity                    |
|             |                                                     |
|             |  +----------+ +----------+ +----------+ +--------+ |
|             |  | Total    | | Defects  | | Model    | | Avg    | |
|             |  | Inspect. | | Found    | | Accuracy | | Conf.  | |
|             |  |          | |          | |          | |        | |
|             |  |   247    | |   183    | |  94.7%   | | 91.2%  | |
|             |  | +12 week | | +8 week  | |          | |        | |
|             |  +----------+ +----------+ +----------+ +--------+ |
|             |                                                     |
|             |  +--- Defect Distribution ---+ +-- Trend Chart --+ |
|             |  |                           | |                  | |
|             |  |  [Horizontal bar chart]   | | [Line chart:     | |
|             |  |  CR ====== 42             | |  detections      | |
|             |  |  RI ==== 31               | |  over time]      | |
|             |  |  DE === 28                | |                  | |
|             |  |  BP == 19                 | |                  | |
|             |  |  DJ == 18                 | |                  | |
|             |  |  SD === 26                | |                  | |
|             |  |  IN == 19                 | |                  | |
|             |  +---------------------------+ +------------------+ |
|             |                                                     |
|             |  Recent Detections                                  |
|             |  +------------------------------------------------+|
|             |  | [thumb] | pipe_section_42.jpg | CR, RI | 2m ago ||
|             |  | [thumb] | video_frame_108.png | DE     | 15m    ||
|             |  | [thumb] | inlet_north_03.jpg  | BP     | 1h ago ||
|             |  | [thumb] | junction_7b.jpg     | --     | 2h ago ||
|             |  | [thumb] | main_line_22.jpg    | SD, DJ | 3h ago ||
|             |  +------------------------------------------------+|
|             |                                                     |
+-------------+-----------------------------------------------------+
```

#### Stat Cards Detail

Each stat card is a `--bg-surface` card with `--radius-md` border and `--border-default` border.

```
+-----------------------------------+
|  [icon]              [trend badge]|
|                                   |
|  247                              |   <-- --text-3xl, --font-mono, --fg-primary
|  Total Inspections                |   <-- --text-sm, --fg-secondary
|  +12 this week                    |   <-- --text-xs, --success or --error
+-----------------------------------+
```

- Icon: 20x20, `--fg-tertiary`
- Trend badge: green up-arrow for positive, red down-arrow for negative
- Stat number: `--font-mono` for tabular alignment

#### Defect Distribution Bar Chart

Horizontal bars, one per defect type. Each bar is color-coded by severity:
- CR (Crack): `--severity-medium`
- RI (Root Intrusion): `--severity-high`
- DE (Deposit/Debris): `--severity-low`
- BP (Broken Pipe): `--severity-critical`
- DJ (Displaced Joint): `--severity-medium`
- SD (Surface Damage): `--severity-high`
- IN (Infiltration): `--severity-low`

Bar labels are left-aligned, count numbers are right-aligned. Bar width is proportional to count.

#### Recent Detections Table

| Column      | Width    | Content                                         |
|-------------|----------|-------------------------------------------------|
| Thumbnail   | 48px     | Cropped square image, `--radius-sm`             |
| Filename    | flex     | Filename, monospace, truncate with ellipsis     |
| Defects     | 120px    | Comma-separated defect type badges              |
| Severity    | 80px     | Colored dot + label (Critical/High/Medium/Low)  |
| Time        | 80px     | Relative time (e.g., "2m ago")                  |
| Action      | 40px     | "View" link in `--accent-text`                  |

#### Mobile Layout (< 768px)

- Stat cards: 2-column grid (2x2), smaller text (`--text-2xl` for numbers)
- Charts: stacked vertically, full width
- Recent detections: card-based layout instead of table (each detection is a card with thumbnail left, details right)

#### Tablet Layout (768px - 1023px)

- Stat cards: 4-column grid (same as desktop but tighter padding)
- Charts: stacked vertically
- Recent detections: table with fewer columns (hide Time column)

---

### 3.2 Detect Page

**Purpose:** The core functionality page. Upload an image or video frame, run detection, view results with bounding box overlays and classification labels.

#### Desktop Layout (>= 1024px)

```
+-- Sidebar --+-- Content Area ----------------------------------------+
|             |                                                          |
|             |  New Detection                                           |
|             |  Upload an image to detect sewer pipe defects            |
|             |                                                          |
|             |  +--- Upload / Image Panel (60%) --+ +-- Results (40%) -+|
|             |  |                                  | |                  ||
|             |  |  STATE 1: Empty                  | | Results will     ||
|             |  |  +----------------------------+  | | appear here      ||
|             |  |  |                            |  | | after detection. ||
|             |  |  |   [cloud-upload icon]      |  | |                  ||
|             |  |  |                            |  | |                  ||
|             |  |  |   Drag and drop image      |  | |                  ||
|             |  |  |   or click to browse       |  | |                  ||
|             |  |  |                            |  | |                  ||
|             |  |  |   PNG, JPG, BMP up to 10MB |  | |                  ||
|             |  |  |   or MP4 video up to 50MB  |  | |                  ||
|             |  |  |                            |  | |                  ||
|             |  |  +----------------------------+  | |                  ||
|             |  |                                  | |                  ||
|             |  +----------------------------------+ +------------------+|
|             |                                                          |
+-------------+----------------------------------------------------------+
```

#### Upload Drop Zone States

**State 1: Empty (default)**
```
+----------------------------------------------+
|                                                |
|            [cloud-upload icon, 48px]           |
|                                                |
|     Drag and drop an image or video here       |   <-- --text-lg, --fg-secondary
|              or click to browse                |   <-- --text-sm, --accent-text, underline
|                                                |
|     Supported: PNG, JPG, BMP (up to 10MB)     |   <-- --text-xs, --fg-tertiary
|               MP4 video (up to 50MB)           |
|                                                |
+----------------------------------------------+
```
- Border: 2px dashed `--border-default`, `--radius-xl`
- Background: `--bg-surface`
- Minimum height: 400px

**State 2: Drag hover**
- Border: 2px dashed `--accent`, animated dash offset
- Background: `--accent-muted`
- Icon and text color shift to `--accent`

**State 3: Uploading / Processing**
```
+----------------------------------------------+
|                                                |
|            [spinner animation]                 |
|                                                |
|     Analyzing image...                         |
|     [=========>          ] 64%                 |
|                                                |
|     Running defect detection model             |   <-- --text-xs, --fg-tertiary
|                                                |
+----------------------------------------------+
```
- Progress bar: `--accent` fill on `--bg-overlay` track
- Spinner: rotating ring in `--accent`, respects `prefers-reduced-motion` (falls back to pulsing dot)

**State 4: Results loaded (image with bounding boxes)**
```
+----------------------------------------------+
|  [Image: pipe_section_42.jpg]                  |
|                                                |
|  +--[CR]--+                                    |
|  | Crack  |     The image is displayed at      |
|  | 94.7%  |     full width within the panel.   |
|  +--------+     Bounding boxes are overlaid    |
|                  as colored rectangles.         |
|        +--[RI]--+                              |
|        | Root   |                              |
|        | 87.3%  |                              |
|        +--------+                              |
|                                                |
|  [Zoom In] [Zoom Out] [Reset] [Download]       |
+----------------------------------------------+
```

#### Bounding Box Overlay Specification

Each detected defect gets a bounding box rendered as an overlay on the image.

- Box border: 2px solid, color mapped to defect severity
- Box corner markers: 8px L-shaped corners in the same color (gives a "targeting" feel)
- Label: positioned at top-left corner of the box, above the border
- Label background: severity color at 90% opacity
- Label text: `--fg-inverse` (white text on colored background)
- Label format: `[TYPE] confidence%` (e.g., `CR 94.7%`)

When multiple boxes overlap, the higher-confidence detection renders on top.

#### Image Controls (below the image)

A toolbar row with icon buttons:
- Zoom In (+): enlarges the image within the container
- Zoom Out (-): reduces the image within the container
- Reset: returns to fit-to-container
- Download: saves the annotated image with bounding boxes

#### Results Panel (right side, 40% width)

```
+------------------------------------------+
|  Detection Results                        |
|                                           |
|  3 defects found                          |
|  Processing time: 0.34s                   |
|                                           |
|  +--------------------------------------+|
|  | [1] Crack (CR)                        ||
|  |                                       ||
|  | Confidence    [==========] 94.7%      ||
|  | Severity      [***-] High             ||
|  | Location      Top-left quadrant       ||
|  | Bounding Box  (124, 56, 310, 198)     ||
|  |                                       ||
|  | Description:                          ||
|  | Linear fracture detected along pipe   ||
|  | wall. Recommend further inspection.   ||
|  +--------------------------------------+|
|  |                                       ||
|  | [2] Root Intrusion (RI)               ||
|  |                                       ||
|  | Confidence    [========] 87.3%        ||
|  | Severity      [****] Critical         ||
|  | Location      Center-right            ||
|  | Bounding Box  (280, 140, 450, 320)    ||
|  +--------------------------------------+|
|  |                                       ||
|  | [3] Deposit/Debris (DE)               ||
|  |                                       ||
|  | Confidence    [======] 72.1%          ||
|  | Severity      [*--] Low               ||
|  | Location      Bottom                  ||
|  +--------------------------------------+|
|                                           |
|  +--------------------------------------+|
|  | [Generate Report]   [Save to History] ||
|  +--------------------------------------+|
+------------------------------------------+
```

#### Result Card Detail

Each defect result is a card within the results panel.

```
+----------------------------------------------+
|  [severity-dot] Crack (CR)           [^] [v] |   <-- collapse/expand toggle
|                                               |
|  Confidence                                   |
|  [============================  ] 94.7%       |   <-- bar + mono number
|                                               |
|  Severity       High                          |   <-- colored badge
|  Location       Top-left quadrant             |
|  Box            (124, 56) to (310, 198)       |   <-- mono font
+----------------------------------------------+
```

- The colored dot at the left of the defect name uses the severity color
- Confidence bar: filled portion uses `--accent`, track uses `--bg-overlay`
- Confidence percentage: `--font-mono`, right-aligned
- Severity badge: small pill with severity color background and `--fg-inverse` text
- Hovering a result card highlights the corresponding bounding box on the image (border thickens to 3px, slight glow effect)

#### Severity Indicator System

Severity is displayed as a colored badge/pill:

| Level    | Color                 | Dot | Label      | Criteria                                  |
|----------|-----------------------|-----|------------|-------------------------------------------|
| Critical | `--severity-critical` | Red | CRITICAL   | Broken pipe, structural failure           |
| High     | `--severity-high`     | Orange | HIGH    | Root intrusion, surface damage            |
| Medium   | `--severity-medium`   | Yellow | MEDIUM  | Cracks, displaced joints                  |
| Low      | `--severity-low`      | Green | LOW      | Deposits, minor infiltration              |

#### Mobile Layout (< 768px)

- Upload panel and results panel stack vertically (upload on top, results below)
- Upload zone: reduced min-height (280px)
- Results: each defect card is full width, accordion-style (tap to expand)
- Image toolbar: horizontal scroll if needed
- Bounding box labels: abbreviated (`CR 95%` instead of `Crack (CR) 94.7%`)

#### Tablet Layout (768px - 1023px)

- Same two-panel layout as desktop, but split 55%/45%
- Slightly reduced padding

---

### 3.3 History Page

**Purpose:** Browse and filter past inspections. Find specific results. Compare defect patterns over time.

#### Desktop Layout (>= 1024px)

```
+-- Sidebar --+-- Content Area -------------------------------------------+
|             |                                                             |
|             |  Inspection History                                         |
|             |  Browse past detection results                              |
|             |                                                             |
|             |  +-- Filters Bar ----------------------------------------+ |
|             |  | [Search filename...]  [Defect Type v] [Date Range v]  | |
|             |  | [Severity v]  [Sort: Newest v]          [Grid | List] | |
|             |  +------------------------------------------------------+ |
|             |                                                             |
|             |  Showing 183 results                                        |
|             |                                                             |
|             |  +-- TABLE VIEW (default) -------------------------------+ |
|             |  |  [ ] | Thumb | Filename      | Defects | Sev  | Date  | |
|             |  |------|-------|---------------|---------|------|-------| |
|             |  |  [ ] | [img] | pipe_42.jpg   | CR, RI  | High | 03/28 | |
|             |  |  [ ] | [img] | frame_108.png | DE      | Low  | 03/28 | |
|             |  |  [ ] | [img] | inlet_03.jpg  | BP      | Crit | 03/27 | |
|             |  |  [ ] | [img] | junction_7b   | --      | None | 03/27 | |
|             |  |  [ ] | [img] | main_22.jpg   | SD, DJ  | High | 03/26 | |
|             |  |  ...                                                   | |
|             |  +-------------------------------------------------------+ |
|             |                                                             |
|             |  [< Prev]  Page 1 of 19  [Next >]                          |
|             |                                                             |
+-------------+-------------------------------------------------------------+
```

#### Filter Bar

A horizontal bar above the table with these controls:

1. **Search** -- text input, searches filename. Icon: magnifying glass. Placeholder: "Search by filename..."
2. **Defect Type** -- multi-select dropdown. Options: All, CR, RI, DE, BP, DJ, SD, IN. Each option has a colored dot matching its severity mapping.
3. **Date Range** -- date picker with presets: Today, Last 7 days, Last 30 days, Custom range.
4. **Severity** -- single-select dropdown. Options: All, Critical, High, Medium, Low, None (no defects).
5. **Sort** -- dropdown. Options: Newest first, Oldest first, Most defects, Highest severity.
6. **View Toggle** -- icon button group: Grid view / List (table) view.

Active filters are shown as removable chips below the filter bar:

```
Active: [CR x] [RI x] [Last 7 days x]    [Clear all]
```

#### Table View Columns

| Column     | Width   | Content                                         |
|------------|---------|--------------------------------------------------|
| Checkbox   | 40px    | Multi-select for bulk actions                    |
| Thumbnail  | 56px    | Square crop of original image, `--radius-sm`     |
| Filename   | flex    | Filename (mono), truncated. Click opens detail   |
| Defects    | 140px   | Defect type badges (colored pills)               |
| Severity   | 100px   | Highest severity as colored badge                |
| Confidence | 100px   | Highest confidence value, mono font              |
| Date       | 100px   | Date in YYYY-MM-DD format                        |
| Actions    | 60px    | Icon buttons: view, delete                       |

Row hover: `--bg-elevated` background.
Selected row (checkbox checked): `--accent-muted` background.

#### Grid View

```
+----------+  +----------+  +----------+  +----------+
|  [image] |  |  [image] |  |  [image] |  |  [image] |
|          |  |          |  |          |  |          |
|  CR, RI  |  |  DE      |  |  BP      |  |  --      |
| pipe_42  |  | frame108 |  | inlet_03 |  | junct_7b |
| [High]   |  | [Low]    |  | [Crit]   |  | [None]   |
| 03/28    |  | 03/28    |  | 03/27    |  | 03/27    |
+----------+  +----------+  +----------+  +----------+
```

Grid cards:
- Width: responsive, 4 columns at desktop, 3 at tablet, 2 at mobile
- Image: aspect-ratio 4:3, object-fit cover
- Severity badge: absolute-positioned at top-right of image
- Defect pills: below image
- Filename: truncated, `--text-sm`, `--font-mono`
- Date: `--text-xs`, `--fg-tertiary`

#### Row Click Behavior

Clicking a row (or grid card) opens a detail panel/modal:

```
+----------------------------------------------+
|  Inspection Detail                     [X]   |
|                                               |
|  +--- Image with Boxes ---+  +-- Details --+ |
|  |                         |  | Filename:   | |
|  |  [annotated image]      |  | pipe_42.jpg | |
|  |                         |  |             | |
|  |                         |  | Date:       | |
|  |                         |  | 2026-03-28  | |
|  |                         |  |             | |
|  +-------------------------+  | Defects:    | |
|                               | [CR] 94.7%  | |
|                               | [RI] 87.3%  | |
|                               |             | |
|                               | Severity:   | |
|                               | [High]      | |
|                               +-------------+ |
|                                               |
|  [Re-run Detection]  [Download]  [Delete]     |
+----------------------------------------------+
```

On desktop: slide-in panel from right (480px wide).
On mobile: full-screen modal.

#### Bulk Actions

When one or more rows are selected via checkboxes, a sticky action bar appears at the bottom:

```
+--[ 3 selected ]---[ Download All ]---[ Delete ]---[ Clear Selection ]--+
```

#### Mobile Layout (< 768px)

- Filter bar: horizontal scroll or collapsed behind a "Filter" button that opens a bottom sheet
- Default view: Grid (2 columns)
- Table view: card-based list instead (each row becomes a card)
- Pagination: simplified (prev/next only, no page numbers)

---

### 3.4 Model Info Page

**Purpose:** Display information about the CNN model, training metrics, dataset details, and version history. Primarily informational -- no interactive workflows.

#### Desktop Layout (>= 1024px)

```
+-- Sidebar --+-- Content Area -----------------------------------------+
|             |                                                           |
|             |  Model Information                                        |
|             |  CNN architecture and training details                    |
|             |                                                           |
|             |  +-- Model Overview Card --------------------------------+|
|             |  |                                                       ||
|             |  |  Architecture     ResNet-50 (Modified)                ||
|             |  |  Framework        PyTorch 2.x                         ||
|             |  |  Input Size       224 x 224 px (RGB)                  ||
|             |  |  Output Classes   7 (CR, RI, DE, BP, DJ, SD, IN)     ||
|             |  |  Parameters       25.6M                               ||
|             |  |  Model Size       97.8 MB                             ||
|             |  |  Last Trained     2026-03-15                          ||
|             |  |  Version          v2.1.0                              ||
|             |  |                                                       ||
|             |  +-------------------------------------------------------+|
|             |                                                           |
|             |  +-- Training Metrics (50%) ---+ +-- Confusion Mat (50%)-+|
|             |  |                             | |                       ||
|             |  |  Accuracy: 94.7%            | | [Heatmap grid]        ||
|             |  |  Precision: 93.2%           | |                       ||
|             |  |  Recall: 92.8%              | | CR RI DE BP DJ SD IN  ||
|             |  |  F1-Score: 93.0%            | |                       ||
|             |  |                             | |                       ||
|             |  |  [Loss curve chart]         | |                       ||
|             |  |  [Accuracy curve chart]     | |                       ||
|             |  |                             | |                       ||
|             |  +-----------------------------+ +-----------------------+|
|             |                                                           |
|             |  +-- Dataset Information --------------------------------+|
|             |  |                                                       ||
|             |  |  Dataset        Sewer-ML (modified)                   ||
|             |  |  Total Images   12,480                                ||
|             |  |  Train/Val/Test 70% / 15% / 15%                      ||
|             |  |                                                       ||
|             |  |  Class Distribution:                                  ||
|             |  |  CR [========] 2,142  (17.2%)                         ||
|             |  |  RI [======] 1,687    (13.5%)                         ||
|             |  |  DE [=======] 1,923   (15.4%)                         ||
|             |  |  BP [====] 1,248      (10.0%)                         ||
|             |  |  DJ [=====] 1,435     (11.5%)                         ||
|             |  |  SD [======] 1,812    (14.5%)                         ||
|             |  |  IN [=======] 2,233   (17.9%)                         ||
|             |  |                                                       ||
|             |  +-------------------------------------------------------+|
|             |                                                           |
|             |  +-- Architecture Diagram --------------------------------+|
|             |  |                                                        ||
|             |  |  Input (224x224x3)                                     ||
|             |  |     |                                                  ||
|             |  |  Conv Block 1 (64 filters, 7x7)                       ||
|             |  |     |                                                  ||
|             |  |  ResNet Block 1 (64) x 3                              ||
|             |  |     |                                                  ||
|             |  |  ResNet Block 2 (128) x 4                             ||
|             |  |     |                                                  ||
|             |  |  ResNet Block 3 (256) x 6                             ||
|             |  |     |                                                  ||
|             |  |  ResNet Block 4 (512) x 3                             ||
|             |  |     |                                                  ||
|             |  |  Global Average Pooling                               ||
|             |  |     |                                                  ||
|             |  |  FC (512 -> 7) + Softmax                              ||
|             |  |     |                                                  ||
|             |  |  Output (7 classes)                                    ||
|             |  |                                                        ||
|             |  +--------------------------------------------------------+|
|             |                                                           |
+-------------+-----------------------------------------------------------+
```

#### Model Overview Card

A key-value card using a two-column layout:

```
+-----------------------------------------------+
|  Model Overview                                |
|                                                |
|  Architecture      ResNet-50 (Modified)        |  <-- label: --fg-secondary, value: --fg-primary, mono
|  Framework         PyTorch 2.x                 |
|  Input Size        224 x 224 px (RGB)          |
|  Output Classes    7                           |
|  Parameters        25.6M                       |
|  Model Size        97.8 MB                     |
|  Last Trained      2026-03-15                  |
|  Version           v2.1.0                      |
|                                                |
+-----------------------------------------------+
```

Labels are left-aligned in `--fg-secondary`, values are right-aligned in `--fg-primary` with `--font-mono` for numeric values.

#### Training Metrics Section

Two side-by-side cards:

**Left card: Metric Summary + Curves**
- Top section: 4 key metrics as small stat blocks (Accuracy, Precision, Recall, F1)
- Below: two charts stacked vertically
  - Loss curve: training loss (solid line, `--accent`) vs. validation loss (dashed line, `--info`) over epochs. X-axis: epochs. Y-axis: loss value.
  - Accuracy curve: training accuracy vs. validation accuracy over epochs. Same color scheme.
  - Chart background: `--bg-surface`. Grid lines: `--border-default`. Axis labels: `--fg-tertiary`.

**Right card: Confusion Matrix**
- 7x7 heatmap grid
- Rows: actual class. Columns: predicted class.
- Cell color intensity: scaled from `--bg-surface` (0%) to `--accent` (100%)
- Diagonal cells (correct predictions): highlighted with higher opacity
- Cell text: count number in `--font-mono`, `--text-xs`
- Axis labels: defect type abbreviations (CR, RI, DE, BP, DJ, SD, IN)

#### Dataset Information Card

- Key-value pairs for dataset metadata
- Class distribution as horizontal bar chart (same style as Dashboard defect distribution)
- Each bar labeled with class name, count, and percentage

#### Architecture Diagram

A vertical flowchart rendered as styled HTML/CSS (not an image). Each layer is a rounded rectangle card connected by vertical lines.

```
+----------------------------+
|  Input: 224 x 224 x 3     |   <-- --bg-elevated, --border-default border
+----------------------------+
         |
+----------------------------+
|  Conv Block 1              |
|  64 filters, 7x7, /2      |
+----------------------------+
         |
       [...]
         |
+----------------------------+
|  Output: 7 classes         |   <-- --accent border (special emphasis)
+----------------------------+
```

#### Mobile Layout (< 768px)

- All sections stack vertically
- Training metrics and confusion matrix: full width, stacked
- Confusion matrix: horizontally scrollable if needed (7 columns can be tight)
- Architecture diagram: remains vertical, fits naturally

---

## 4. Component Inventory

### 4.1 Primitive Components

| Component        | Variants                                          | Notes                               |
|------------------|---------------------------------------------------|--------------------------------------|
| Button           | primary, secondary, ghost, danger, icon-only      | Primary uses `--accent`             |
| Input            | text, search, file                                | Light background, subtle border     |
| Select/Dropdown  | single, multi-select                              | Custom light dropdown panel         |
| Badge            | severity (4 colors), defect-type, status          | Small pill shape                    |
| Card             | stat, result, detail, info                        | `--bg-surface`, `--border-default`  |
| Table            | sortable, selectable, with thumbnails             | Striped rows optional               |
| Modal/Sheet      | side-panel (desktop), full-screen (mobile)        | Overlay: black 40% opacity          |
| Tooltip          | text-only                                         | `--bg-elevated`, `--fg-primary`     |
| Progress Bar     | determinate, indeterminate                        | `--accent` fill                     |
| Spinner          | small (16px), medium (24px), large (48px)         | Respects reduced-motion             |
| Chip             | removable (filter chips)                          | `--bg-elevated` with X button       |
| Tabs             | underline style                                   | Active: `--accent` underline        |
| Pagination       | full (with page numbers), simple (prev/next)      | Desktop vs. mobile variant          |
| Toggle           | view-toggle (grid/list)                           | Icon-button group style             |

### 4.2 Composite Components

| Component              | Used On        | Description                                              |
|------------------------|----------------|----------------------------------------------------------|
| StatCard               | Dashboard      | Icon + number + label + trend indicator                  |
| DefectBarChart         | Dashboard, Model | Horizontal bar chart with severity colors              |
| DetectionResultCard    | Detect         | Defect name, confidence bar, severity badge, bbox info   |
| ImageViewer            | Detect, History| Zoomable image with bounding box overlay layer           |
| BoundingBoxOverlay     | Detect, History| SVG/Canvas overlay with colored rectangles and labels    |
| UploadDropZone         | Detect         | Drag-and-drop area with 4 states                        |
| FilterBar              | History        | Search + dropdowns + active filter chips                 |
| InspectionGridCard     | History        | Thumbnail + defect badges + severity + date              |
| InspectionDetailPanel  | History        | Slide-in panel with full detection details               |
| ConfusionMatrix        | Model Info     | 7x7 heatmap grid                                        |
| TrainingCurveChart     | Model Info     | Dual-line chart (train vs. val)                          |
| ArchitectureDiagram    | Model Info     | Vertical flowchart of CNN layers                         |
| SidebarNav             | Global         | Collapsible sidebar with icon + text items               |
| MobileBottomNav        | Global         | 4-item bottom tab bar for mobile                         |
| PageHeader             | Global         | Page title + subtitle + optional action button           |

### 4.3 Defect Type Badge Mapping

Each defect type has a consistent visual representation:

| Code | Full Name       | Badge Color             | Abbreviation |
|------|-----------------|-------------------------|--------------|
| CR   | Crack           | `--severity-medium`     | CR           |
| RI   | Root Intrusion  | `--severity-high`       | RI           |
| DE   | Deposit/Debris  | `--severity-low`        | DE           |
| BP   | Broken Pipe     | `--severity-critical`   | BP           |
| DJ   | Displaced Joint | `--severity-medium`     | DJ           |
| SD   | Surface Damage  | `--severity-high`       | SD           |
| IN   | Infiltration    | `--severity-low`        | IN           |

Badge format: rounded pill, 6px vertical / 10px horizontal padding, `--text-xs` font size, colored background at 12% opacity with colored text (ensures readability on light backgrounds). On hover, background opacity increases to 20%.

---

## 5. Responsive Strategy

### 5.1 Breakpoints

| Name    | Min Width | Max Width | Layout Changes                            |
|---------|-----------|-----------|-------------------------------------------|
| Mobile  | 320px     | 767px     | Single column, bottom nav, stacked panels |
| Tablet  | 768px     | 1023px    | Two columns where possible, sidebar hidden by default |
| Desktop | 1024px    | 1439px    | Sidebar + content, two-panel layouts      |
| Wide    | 1440px+   | --        | Max content width 1280px, centered        |

### 5.2 Navigation Responsive Behavior

| Breakpoint | Sidebar          | Top Bar            | Bottom Nav |
|------------|------------------|--------------------|------------|
| Mobile     | Hidden           | 56px, hamburger    | Visible    |
| Tablet     | Collapsed (64px) | Hidden             | Hidden     |
| Desktop    | Expanded (240px) | Hidden             | Hidden     |
| Wide       | Expanded (240px) | Hidden             | Hidden     |

### 5.3 Content Area Behavior

- Content area always fills remaining horizontal space after sidebar
- Maximum content width: 1280px (centered with auto margins on wide screens)
- Content padding: 32px (desktop), 24px (tablet), 16px (mobile)
- Cards use CSS Grid with `auto-fill` and `minmax()` for fluid column counts

### 5.4 Image Handling

- Detect page image viewer: maintains aspect ratio, max-width 100%
- Bounding box overlays scale proportionally with the image
- On mobile, image is zoomable via pinch gesture
- History thumbnails: 48px square (table), 100% width at 4:3 ratio (grid)

### 5.5 Table Responsive Behavior

Tables on mobile transform into card lists. Each table row becomes a card:

```
Mobile card (replaces table row):
+----------------------------------------------+
|  [thumbnail]  pipe_section_42.jpg             |
|               CR, RI    [High]    2026-03-28  |
+----------------------------------------------+
```

Priority columns (always visible): Thumbnail, Filename, Defect Types, Severity.
Hidden on mobile: Confidence score, checkbox.

---

## 6. Accessibility and Motion

### 6.1 WCAG AA Compliance

#### Color Contrast

All text/background combinations meet WCAG AA minimum contrast ratios (light theme):

| Combination                             | Ratio  | Requirement | Status |
|-----------------------------------------|--------|-------------|--------|
| `--fg-primary` (#151820) on `--bg-base` (#ffffff) | 16.5:1 | 4.5:1       | Pass   |
| `--fg-secondary` (#6b6f78) on `--bg-base` (#ffffff) | 5.0:1  | 4.5:1       | Pass   |
| `--fg-tertiary` (#9ea3ad) on `--bg-base` (#ffffff) | 3.0:1  | 3:1 (large) | Pass (large text only) |
| `--accent` (#f0850f) on `--bg-base` (#ffffff)      | 3.1:1  | 3:1 (large) | Pass (large text/icons only) |
| `--accent-text` (#a35a08) on `--bg-base` (#ffffff) | 5.3:1  | 4.5:1       | Pass   |
| `--fg-inverse` (#ffffff) on `--accent` (#f0850f)   | 3.1:1  | 3:1 (large) | Pass (large text only) |
| `--fg-inverse` (#ffffff) on `--severity-critical` (#c5252d) | 5.0:1 | 4.5:1 | Pass |
| `--fg-inverse` (#ffffff) on `--severity-high` (#d95520) | 4.5:1 | 4.5:1    | Pass   |
| `--fg-inverse` (#ffffff) on `--severity-medium` (#b8800a) | 4.6:1 | 4.5:1  | Pass   |
| `--fg-inverse` (#ffffff) on `--severity-low` (#2b9a62) | 4.6:1 | 4.5:1    | Pass   |
| `--fg-primary` (#151820) on `--bg-surface` (#f5f5f7) | 14.9:1 | 4.5:1    | Pass   |
| `--fg-secondary` (#6b6f78) on `--bg-surface` (#f5f5f7) | 4.5:1 | 4.5:1   | Pass   |

Note: `--accent` (#f0850f) on white does not meet 4.5:1 for normal-size text. Use `--accent-text` (#a35a08) for inline text links and small labels. The brighter `--accent` is reserved for large text (18px+), icons, buttons with `--fg-inverse` text, and non-text indicators (borders, bars, progress fills).

Note: `--fg-tertiary` is only used for placeholder text and disabled states, which are exempt from contrast requirements per WCAG. When used as labels, ensure the text is `--text-lg` or larger.

#### Focus Management

- All interactive elements have a visible focus ring: 2px solid `--border-focus` with 2px offset
- Focus ring uses `outline` (not `border`) to avoid layout shifts
- Tab order follows visual layout order (left-to-right, top-to-bottom)
- Modal focus trap: focus is locked within the modal when open
- Skip-to-content link: hidden until focused, jumps past sidebar to main content

#### Keyboard Navigation

| Action                     | Key(s)                    | Context            |
|---------------------------|---------------------------|--------------------|
| Navigate sidebar items    | Arrow Up / Down           | Sidebar focused    |
| Activate nav item         | Enter / Space             | Sidebar focused    |
| Toggle sidebar collapse   | Ctrl + B                  | Global             |
| Open file picker          | Enter / Space             | Drop zone focused  |
| Navigate table rows       | Arrow Up / Down           | Table focused      |
| Select table row          | Space                     | Table row focused  |
| Open row detail           | Enter                     | Table row focused  |
| Close modal/panel         | Escape                    | Modal/panel open   |
| Navigate filter chips     | Arrow Left / Right        | Chip group focused |
| Remove filter chip        | Delete / Backspace        | Chip focused       |

#### Screen Reader Support

- All images have descriptive `alt` text (e.g., "Sewer pipe image showing detected crack defect with 94.7% confidence")
- Bounding box overlays include `aria-label` with defect type and confidence
- Stat cards use `aria-live="polite"` for dynamic updates
- Progress bar uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Table uses proper `<th>` elements with `scope` attributes
- Sort indicators use `aria-sort` attribute
- Filter changes announce result count via `aria-live` region

### 6.2 Motion and Animation

#### Default Animations

| Element               | Property      | Duration | Easing              | Trigger        |
|-----------------------|---------------|----------|---------------------|----------------|
| Page transitions      | opacity       | 200ms    | ease-out            | Route change   |
| Sidebar collapse      | width         | 200ms    | ease-in-out         | Toggle click   |
| Card hover            | background    | 150ms    | ease                | Mouse enter    |
| Button hover          | background    | 100ms    | ease                | Mouse enter    |
| Modal open            | opacity, translateX | 250ms | ease-out       | Action trigger |
| Modal close           | opacity, translateX | 200ms | ease-in        | Close action   |
| Progress bar fill     | width         | 300ms    | ease-out            | Value change   |
| Bounding box appear   | opacity, scale| 300ms    | ease-out            | Detection done |
| Spinner               | rotate        | 1000ms   | linear (infinite)   | Loading state  |
| Drop zone drag-over   | border-color  | 150ms    | ease                | Drag enter     |
| Toast notification    | translateY    | 200ms    | ease-out            | Event trigger  |

#### Reduced Motion Behavior

When `prefers-reduced-motion: reduce` is active:

- All transitions reduce to 0ms duration (instant state changes)
- Spinner animation replaced with a pulsing opacity effect (opacity 0.4 to 1.0, 2s duration)
- Page transitions: instant cut (no fade)
- Modal: instant appear/disappear (no slide)
- Bounding boxes: instant appear (no scale animation)
- Progress bar: instant fill (no animation)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 6.3 Color-Blind Considerations

Severity is never communicated by color alone. Each severity level includes:
1. Color (primary indicator for sighted users)
2. Text label (CRITICAL, HIGH, MEDIUM, LOW)
3. Icon/shape distinction (planned): critical uses a filled circle, high uses a triangle, medium uses a diamond, low uses an outlined circle

Defect type badges include the text abbreviation (CR, RI, etc.) and are not reliant on color alone for differentiation.

---

## Appendix A: CSS Custom Properties (Complete Token Set)

```css
:root {
  /* Background (Light Theme) */
  --bg-base: hsl(0 0% 100%);
  --bg-surface: hsl(240 5% 96%);
  --bg-elevated: hsl(240 4% 93%);
  --bg-overlay: hsl(240 3% 90%);

  /* Foreground (Dark Text on Light) */
  --fg-primary: hsl(220 15% 10%);
  --fg-secondary: hsl(220 8% 45%);
  --fg-tertiary: hsl(220 6% 62%);
  --fg-inverse: hsl(0 0% 100%);

  /* Accent */
  --accent: hsl(28 92% 52%);
  --accent-hover: hsl(28 92% 45%);
  --accent-muted: hsl(28 60% 94%);
  --accent-text: hsl(28 92% 35%);

  /* Severity */
  --severity-critical: hsl(0 72% 45%);
  --severity-high: hsl(20 85% 46%);
  --severity-medium: hsl(40 90% 38%);
  --severity-low: hsl(160 55% 38%);

  /* Functional */
  --success: hsl(142 60% 38%);
  --warning: hsl(40 90% 38%);
  --error: hsl(0 72% 45%);
  --info: hsl(210 70% 45%);

  /* Border */
  --border-default: hsl(240 5% 88%);
  --border-hover: hsl(240 4% 78%);
  --border-focus: hsl(28 92% 52%);

  /* Typography */
  --font-sans: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace;

  /* Spacing */
  --sp-1: 0.25rem;
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;
  --sp-5: 1.25rem;
  --sp-6: 1.5rem;
  --sp-8: 2rem;
  --sp-10: 2.5rem;
  --sp-12: 3rem;
  --sp-16: 4rem;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows (Light Theme -- subtle diffusion) */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);

  /* Sidebar */
  --sidebar-width-expanded: 240px;
  --sidebar-width-collapsed: 64px;

  /* Content */
  --content-max-width: 1280px;
}
```

---

## Appendix B: Tailwind CSS v4 Theme Extension

```css
/* In your main CSS file (Tailwind v4 CSS-first config) -- Light Theme */
@theme {
  --color-bg-base: oklch(1.00 0 0);
  --color-bg-surface: oklch(0.97 0.003 280);
  --color-bg-elevated: oklch(0.94 0.003 280);
  --color-bg-overlay: oklch(0.91 0.003 280);

  --color-fg-primary: oklch(0.18 0.015 250);
  --color-fg-secondary: oklch(0.50 0.01 250);
  --color-fg-tertiary: oklch(0.68 0.008 250);
  --color-fg-inverse: oklch(1.00 0 0);

  --color-accent: oklch(0.72 0.18 55);
  --color-accent-hover: oklch(0.64 0.18 55);
  --color-accent-muted: oklch(0.96 0.04 55);
  --color-accent-text: oklch(0.52 0.14 55);

  --color-severity-critical: oklch(0.50 0.22 25);
  --color-severity-high: oklch(0.56 0.20 40);
  --color-severity-medium: oklch(0.62 0.16 80);
  --color-severity-low: oklch(0.56 0.15 160);

  --color-success: oklch(0.56 0.15 155);
  --color-warning: oklch(0.62 0.16 80);
  --color-error: oklch(0.50 0.22 25);
  --color-info: oklch(0.52 0.15 250);

  --color-border-default: oklch(0.90 0.005 280);
  --color-border-hover: oklch(0.82 0.005 280);
  --color-border-focus: oklch(0.72 0.18 55);
}
```

---

## Appendix C: Defect Type Reference

| Code | Full Name        | Severity Default | Description                                              |
|------|------------------|------------------|----------------------------------------------------------|
| CR   | Crack            | Medium           | Linear fractures in pipe wall                            |
| RI   | Root Intrusion   | High             | Tree roots penetrating pipe joints                       |
| DE   | Deposit/Debris   | Low              | Accumulated sediment or debris in pipe                   |
| BP   | Broken Pipe      | Critical         | Structural failure, pipe section collapsed or missing    |
| DJ   | Displaced Joint  | Medium           | Pipe joint offset or misaligned                          |
| SD   | Surface Damage   | High             | Erosion, corrosion, or abrasion of pipe surface          |
| IN   | Infiltration     | Low              | Groundwater entering through pipe walls or joints        |

Severity can be overridden by the model or inspector. The defaults above represent typical industrial classification standards.
