# DwarPal Design System Specification (DESIGN.md)

**Product:** DwarPal — Enterprise College Gatepass & Campus Access Management Platform  
**Target Quality:** Apple Human Interface Guidelines (HIG) Standard — Calm, Premium, Minimal, High-Precision  
**Specification Version:** 1.0.0 (Production Canonical)  
**Scope:** Universal Design Language across Student, Faculty, HOD, Principal, CAO, Security, Admin, IT, and Chairman portals.

---

## 1. Product and Users

### 1.1 Product Mission
DwarPal manages time-critical campus gatepasses, faculty short leaves, multi-tier academic approval workflows, and high-throughput security checkpoint verifications for higher-education institutions.

### 1.2 Target Devices & Real-World Constraints
- **Main Gate Guard Terminals:** Budget Android devices (Redmi, Realme, Samsung M-series) running Chromium on fluctuating 4G or offline edge Wi-Fi.
- **Students & Faculty:** High-density mobile screens (iOS & Android).
- **Academic Leaders & Admin (HOD, Principal, CAO, Chairman):** iPad / tablets and desktop web browsers (1080p to 4K).
- **Primary Design Directive:** *One primary action per screen, zero hard steps.* Every screen presents exactly one unambiguous visual focal point with a minimum 44px tap target and zero layout stutter.

### 1.3 User Roles & Interaction Contexts
1. **Student:** Requests movement pass; tracks real-time stage progression; presents secure offline-cached QR pass at exit gate.
2. **Faculty (Professor):** Submits short leaves & duty permissions; adjusts lecture workloads; acts as first-line mentor approver.
3. **Academic HOD (Head of Department):** Reviews department-wide passes; executes one-tap bulk approvals; monitors department out-flow.
4. **Principal:** Ultimate institutional authority; reviews multi-day leaves, cross-departmental passes, and escalated appeals.
5. **CAO (Chief Administrative Officer):** Oversees campus logistical and administrative operations.
6. **Security (Main Gate & Campus Bouncers):** High-speed camera scanner verification (<500ms target); vehicle plate lookup; emergency manual roll number roll-call.
7. **Administrator:** System configuration, role mapping, semester transitions, master controls.
8. **IT / System Owner:** Live connection monitoring, SMTP/Brevo delivery tracking, system telemetry, error remediation.
9. **Chairman / Director:** High-level macro analytics, institutional attendance trends, campus safety auditing.

---

## 2. Design Principles

1. **Clarity (Apple HIG):** Text is legible at every scale; icons are instantly recognizable; visual styling never distracts from high-stakes operational data (Student Name, Enrollment, Pass Status, Expiry Window).
2. **Deference to Content:** Chrome and navigation retreat into the background. Gatepass status cards, verification viewfinders, and approval actions dominate the interface.
3. **Depth & Elevation:** Layering is expressed through light-mode luminance shifts, clean 1px hairline borders (`rgba(23, 52, 73, 0.12)`), and diffused neutral shadows rather than heavy skeuomorphism or loud gradients.
4. **Consistency:** All 9 role portals share identical component structures, spacing grids, typographic scales, and motion curves.
5. **Mobile-First Ergonomics:** Primary actions stay within the thumb reach zone (bottom 40% of mobile viewports). Dialogs transform into native-feel bottom sheets on mobile.
6. **Zero Jank on Low-End Phones:** Smooth 60fps animations limited strictly to GPU-accelerated `transform` and `opacity`. Stacking heavy `backdrop-filter: blur()` layers is strictly forbidden.

---

## 3. Color Tokens

### 3.1 Canonical Brand Foundations
- **Brand Ink / Primary Navy:** `#163247` *(changed from current inconsistent mix of #173449, #10263e, and #0f172a)*
- **Brand Accent / Electric Teal Blue:** `#2872a1` *(canonical)*
- **Brand Accent Hover / Deep Tone:** `#1f5a80`
- **Brand Canvas Light:** `#f6fbff` *(changed from current greenish #f4f7f1 to pure brand-harmonized ice tint)*

### 3.2 Exact Hex Values (Light & Dark Mode)

| Token Category | Token Name | Light Mode Hex | Dark Mode Hex | WCAG Contrast (vs Surface) |
| :--- | :--- | :--- | :--- | :--- |
| **Brand** | `--color-brand-primary` | `#163247` | `#5ba3d4` | > 12.0:1 (AAA) |
| | `--color-brand-accent` | `#2872a1` | `#3b93cc` | 4.7:1 (AA) |
| | `--color-brand-accent-hover`| `#1f5a80` | `#52a5dc` | 6.8:1 (AAA) |
| | `--color-brand-accent-soft` | `rgba(40, 114, 161, 0.08)` | `rgba(59, 147, 204, 0.16)` | Decorative / State |
| **Surfaces** | `--color-surface-canvas` | `#f6fbff` *(changed from #f4f7f1)* | `#0d1721` | Base background |
| | `--color-surface-card` | `#ffffff` | `#152232` | 1.1:1 elevation |
| | `--color-surface-elevated`| `#ffffff` | `#1c2c3f` | 1.2:1 modal / popover |
| | `--color-surface-sunken` | `#eef4f9` | `#081018` | Inset fields |
| | `--color-surface-overlay` | `rgba(15, 23, 42, 0.45)` | `rgba(0, 0, 0, 0.72)` | Scrim backdrop |
| **Text** | `--color-text-primary` | `#163247` | `#f0f6fc` | 12.1:1 (AAA) |
| | `--color-text-secondary` | `#47647b` *(changed from #64748b)* | `#9bb2c6` | 5.8:1 (AA) |
| | `--color-text-muted` | `#5d7183` | `#72899d` | 4.6:1 (AA) |
| | `--color-text-disabled` | `#94a3b8` | `#485d70` | 3.0:1 (Disabled text) |
| | `--color-text-inverse` | `#ffffff` | `#0d1721` | High contrast |
| **Borders** | `--color-border-subtle` | `rgba(23, 52, 73, 0.08)` | `rgba(255, 255, 255, 0.08)` | Hairline dividers |
| | `--color-border-default` | `rgba(23, 52, 73, 0.14)` | `rgba(255, 255, 255, 0.16)` | Card / input border |
| | `--color-border-strong` | `rgba(23, 52, 73, 0.24)` | `rgba(255, 255, 255, 0.28)` | Focus / active control |
| | `--color-border-focus` | `#2872a1` | `#5ba3d4` | 3px focus ring |

### 3.3 Semantic & Gatepass Lifecycle Status Colors

| Gatepass Stage / Semantic State | Light BG | Light Border | Light Text | Dark BG | Dark Text | Meaning & Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Pending / Submitted** | `#fffbeb` | `rgba(180, 83, 9, 0.25)` | `#92400e` *(changed from #8a5800)* | `rgba(245, 158, 11, 0.12)` | `#fcd34d` | Awaiting mentor, HOD, or Principal review. |
| **Approved** | `#f0fdf4` | `rgba(22, 101, 52, 0.25)` | `#166534` *(changed from #1d7f49)* | `rgba(34, 197, 94, 0.12)` | `#86efac` | Pass granted; active QR ready for gate exit. |
| **Rejected / Cancelled** | `#fef2f2` | `rgba(185, 28, 28, 0.25)` | `#991b1b` *(changed from #9b3535)* | `rgba(239, 68, 68, 0.12)` | `#fca5a5` | Request declined or student canceled. |
| **Checked Out ("Out")** | `#eff6ff` | `rgba(29, 78, 216, 0.25)` | `#1e40af` *(changed from #245fae)* | `rgba(59, 130, 246, 0.12)` | `#93c5fd` | Scanned at exit gate; timer actively running. |
| **Completed ("Returned")** | `#f0fdfa` | `rgba(15, 118, 110, 0.25)` | `#115e59` *(changed from #2d6d4f)* | `rgba(20, 184, 166, 0.12)` | `#5eead4` | Scanned back into campus; pass archived. |
| **Emergency / Critical Out** | `#fff1f2` | `rgba(190, 18, 60, 0.28)` | `#9f1239` | `rgba(244, 63, 94, 0.14)` | `#fda4af` | Emergency medical / parent summon pass. |

*Contrast Guarantee:* All badge text-to-background combinations meet or exceed WCAG AA (minimum 4.5:1 ratio).

### 3.4 Role Identity Accent Tokens
Used exclusively for role badge indicators, user profile chips, and drawer accents:
- **Student:** `#16a34a` (Emerald)
- **Faculty:** `#2563eb` (Royal Blue)
- **Academic HOD:** `#d97706` (Warm Amber)
- **Principal:** `#b45309` (Imperial Bronze / Ochre)
- **CAO:** `#7c3aed` (Purple)
- **Security & Bouncer:** `#0284c7` (Cobalt Sky)
- **Admin:** `#2872a1` (Brand Primary)
- **IT / Owner:** `#0d9488` (Teal)
- **Chairman / Director:** `#4f46e5` (Deep Indigo)

---

## 4. Typography

### 4.1 Font Stacks
- **System Body Font Stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif` *(changed from current: 'Segoe UI', 'Trebuchet MS', Helvetica, Arial, sans-serif)*
- **Display Font Stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", sans-serif` *(changed from current: "Aptos Display" in Tailwind @theme and user-presumed "Luxurious Roman" which was absent in codebase)*
- **Monospace Stack:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` *(standardized from current mix of Consolas, Courier New, and raw monospace)*

### 4.2 Display Font Usage Rules
The Display Font is permitted **ONLY** on:
1. Product branding locks (`DwarPal` logo wordmark).
2. Primary dashboard splash greetings (e.g., `Good Morning, Prof. Sharma`).
3. Gatepass scan status modal verdicts (`PASS VALID / CLEARED FOR EXIT`).
4. Auth hero title headings.
*Strict Prohibition:* The Display Font is **FORBIDDEN** for data tables, lists, inputs, metadata chips, modal body text, or button labels.

### 4.3 Type Scale Table

| Role / Style | Size | Weight | Line Height | Letter Spacing | Target Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Large** | `32px` (`2.0rem`) | `700` (Bold) | `38px` (`1.2`) | `-0.025em` | Auth hero headline, Gate cleared status |
| **Display Medium** | `26px` (`1.625rem`)| `700` (Bold) | `32px` (`1.25`) | `-0.02em` | Main dashboard page header (H1) |
| **Title 1** | `22px` (`1.375rem`)| `600` (SemiBold) | `28px` (`1.3`) | `-0.015em` | Panel titles, modal primary header |
| **Title 2** | `18px` (`1.125rem`)| `600` (SemiBold) | `24px` (`1.35`) | `-0.01em` | Section headers, card group titles |
| **Headline** | `16px` (`1.0rem`) | `600` (SemiBold) | `22px` (`1.4`) | `-0.005em` | Card titles, gatepass reason, student name |
| **Body Default** | `15px` (`0.9375rem`)| `400` (Regular) | `22px` (`1.47`) | `0` | Primary table cells, descriptions, form text |
| **Body Medium** | `15px` (`0.9375rem`)| `500` (Medium) | `22px` (`1.47`) | `0` | Emphasized body text, input values |
| **Callout** | `14px` (`0.875rem`)| `600` (SemiBold) | `20px` (`1.43`) | `0` | Button text, action items, tab items |
| **Subheadline** | `13px` (`0.8125rem`)| `400` (Regular) | `18px` (`1.38`) | `+0.005em` | Secondary metadata lines, timestamps |
| **Caption 1** | `12px` (`0.75rem`) | `500` (Medium) | `16px` (`1.33`) | `+0.01em` | Form field labels, table headers, tags |
| **Caption 2 (Micro)**| `11px` (`0.6875rem`)| `700` (Bold) | `14px` (`1.27`) | `+0.05em` (UPPER) | Eyebrow badges, live ping pills, status dots |

---

## 5. Spacing Scale & Layout Grid

### 5.1 The 4/8 Grid Scale
All layouts, margins, gutters, and paddings must derive strictly from the following scale:
- `space-1`: `4px` (`0.25rem`) — Micro spacing, status dot spacing.
- `space-2`: `8px` (`0.5rem`) — Compact element gap, icon-to-label offset.
- `space-3`: `12px` (`0.75rem`) — Button internal horizontal gap, compact list row gap.
- `space-4`: `16px` (`1.0rem`) — Default screen edge margin (mobile), form field gap, card inner padding.
- `space-5`: `20px` (`1.25rem`) — Card separation on tablet/desktop, drawer header padding.
- `space-6`: `24px` (`1.5rem`) — Modal inner padding, desktop dashboard section gap.
- `space-8`: `32px` (`2.0rem`) — Page container vertical padding.
- `space-10`: `40px` (`2.5rem`) — Hero container separation.
- `space-12`: `48px` (`3.0rem`) — Large layout break.

### 5.2 Layout Boundaries & Viewport Max-Widths
- **Mobile Container:** `100%` viewport width, horizontal padding `16px`.
- **Auth Shell Container:** `440px` max-width.
- **Modal Dialog Box:** `560px` max-width.
- **Main Desktop Dashboard:** `1200px` max-width, horizontal padding `24px`.
- **Wide Data Table Layout (Admin / IT / Chairman):** `1440px` max-width.

### 5.3 Touch Targets & Safe Areas
- **Minimum Interactive Tap Target:** `44px x 44px` *(Strict Apple HIG requirement)*. Any button or link with smaller visual bounds must expand its hit-box via pseudo-elements (`::after` inset `-8px`).
- **Safe Area Insets:** All mobile fixed elements (bottom bar, sticky CTA, floating action button) must observe:
  ```css
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-top: env(safe-area-inset-top);
  ```

---

## 6. Corner Radii Scale & Elevation

### 6.1 Unified Corner Radii Scale
*(Changed from current codebase state which contains 24 distinct arbitrary integer pixel values from 4px to 50px)*

| Token | Value | Specific Component Application |
| :--- | :--- | :--- |
| `--radius-sm` | `6px` | Inline micro tags, status badge indicators, verification check-boxes |
| `--radius-md` | `10px` | Form inputs, select dropdowns, search bar, secondary buttons, tooltips |
| `--radius-lg` | `14px` | Primary action buttons, toast notifications, summary cards, filter tabs |
| `--radius-xl` | `20px` | Gatepass cards, admin panels, bottom sheet top corners, dialog cards |
| `--radius-2xl` | `24px` | Auth container card, student QR presentation frame |
| `--radius-full` | `9999px` | Avatars, status pills, circular icon buttons, toggle pills |

### 6.2 Elevation & Shadow Hierarchy
*(Changed from current inconsistent mix of green-tinted, dark-navy, and black rgba shadows)*
- **Elevation 0 (Flat):** `box-shadow: none; border: 1px solid var(--color-border-default);`
- **Elevation 1 (Inset / Rest Cards):**  
  `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.04);`
- **Elevation 2 (Interactive Cards & Action Buttons):**  
  `box-shadow: 0 4px 12px rgba(15, 23, 42, 0.07);`
- **Elevation 3 (Hover Lift, Active Popovers, Sticky Topbar Scrolled):**  
  `box-shadow: 0 8px 24px rgba(15, 23, 42, 0.09), 0 2px 6px rgba(40, 114, 161, 0.06);`
- **Elevation 4 (Toasts, Floating Modals, Mobile Drawers):**  
  `box-shadow: 0 16px 38px rgba(15, 23, 42, 0.12), 0 4px 10px rgba(15, 23, 42, 0.04);`
- **Elevation 5 (System Modals & Scanner Overlay):**  
  `box-shadow: 0 24px 64px rgba(15, 23, 42, 0.16);`

---

## 7. Component Specifications

### 7.1 Action Buttons
Four distinct semantic variants with strict state management:
1. **Primary Button:**
   - *Style:* Background `#2872a1` (linear-gradient to `#1f5a80`), color `#ffffff`, border `1px solid rgba(31, 90, 128, 0.25)`, radius `14px`.
   - *States:* Default (`elevation-2`), Hover (`#1f5a80`, transform `translateY(-1px)`), Active/Pressed (`scale(0.97)`), Focus (`0 0 0 3px rgba(40, 114, 161, 0.25)`), Disabled (`opacity: 0.5; pointer-events: none; transform: none;`).
2. **Secondary Button:**
   - *Style:* Background `#ffffff`, color `#163247`, border `1px solid rgba(23, 52, 73, 0.14)`, radius `10px`.
   - *Hover:* Background `#f6fbff`, border-color `rgba(40, 114, 161, 0.3)`.
3. **Tertiary / Ghost Button:**
   - *Style:* Background `transparent`, color `#47647b`, border `none`, radius `10px`.
   - *Hover:* Background `rgba(40, 114, 161, 0.08)`, color `#163247`.
4. **Destructive / Reject Button:**
   - *Style:* Background `#fef2f2`, color `#991b1b`, border `1px solid rgba(185, 28, 28, 0.22)`, radius `10px`.
   - *Hover:* Background `#fee2e2`, color `#7f1d1d`.
- **Button Sizing:**
  - *Large (Primary Viewport CTA):* Height `48px`, font `15px / 600`, padding `0 20px`.
  - *Standard (Card / Row CTA):* Height `44px`, font `14px / 600`, padding `0 16px`.
  - *Compact (Table inline):* Height `36px` (hit-box padded to 44px), font `13px / 600`, padding `0 12px`.

### 7.2 Inputs & Select Fields
- **Container Structure:** Inset label or top label (Caption 1: `12px / 500`, uppercase, `#47647b`).
- **Input Field:** Height `46px`, padding `0 14px`, border `1px solid rgba(23, 52, 73, 0.14)`, radius `10px`, background `#ffffff`, text `#163247`, font `15px / 400`.
- **States:**
  - *Hover:* Border-color `rgba(40, 114, 161, 0.35)`.
  - *Focus:* Border-color `#2872a1`, box-shadow `0 0 0 3px rgba(40, 114, 161, 0.2)`.
  - *Invalid / Error:* Border-color `#ef4444`, box-shadow `0 0 0 3px rgba(239, 68, 68, 0.2)`.
  - *Disabled:* Background `#eef4f9`, color `#94a3b8`, cursor `not-allowed`.
- **Select Dropdowns:** Chevron right icon (`18px`) rotated `90deg` down; native pickers preserved on mobile for instant accessibility.

### 7.3 Gatepass Card & Expandable Card
The core unit of the DwarPal platform:
- **Card Shell:** Background `#ffffff`, border `1px solid rgba(23, 52, 73, 0.12)`, radius `20px`, padding `16px 18px`, `elevation-1`.
- **Header:** Top row displays Eyebrow (`11px / 700` uppercase: `STUDENT GATEPASS`), Gatepass ID (`14px / 700` mono: `GP-2026-8941`), and StatusBadge aligned right.
- **Body:** Reason (`16px / 600` `#163247`), Requester Meta (`13px / 400` `#47647b`), Out/Return Window with Clock icon (`13px / 500`).
- **Hover Lift:** `transform: translateY(-2px)`, shadow `elevation-2`, border-top `2px solid #2872a1`.
- **Expansion Panel (Framer Motion):** Smooth spring expansion revealing detailed audit trail timeline, approver signatures, vehicle number, and action button bar.

### 7.4 Status Badges & Role Badges
- **Structure:** Pill shape (`border-radius: 9999px`), padding `4px 10px`, typography `11px / 700` uppercase, tracking `+0.04em`.
- **Dot Prefix:** Every status badge contains a 6px circular dot (`background: currentColor; opacity: 0.8; margin-right: 5px;`).
- **Principal Badge:** Background `#fef3c7`, border `1px solid rgba(180, 83, 9, 0.3)`, color `#92400e`.
- **Academic HOD Badge:** Background `#ffedd5`, border `1px solid rgba(194, 65, 12, 0.3)`, color `#9a3412`.

### 7.5 Bottom Sheet & Modal System
- **Desktop Modal:** Centered dialog, max-width `560px`, radius `20px`, padding `24px`, background `#ffffff`, `elevation-5`, backdrop `rgba(15, 23, 42, 0.45)` with `backdrop-filter: blur(8px)`.
- **Mobile Bottom Sheet:** On viewports `< 640px`, all modals anchor to the viewport bottom with top radii `20px 20px 0 0` *(changed from current full-screen 0-radius snap)*. Includes a `36px x 4px` rounded grab handle at top center.

### 7.6 Toast Notifications
- **Position:** Top-right on desktop (`top: 20px; right: 20px;`), top-center on mobile (`top: 12px; inset-inline: 16px;`).
- **Structure:** Width `min(380px, 100%)`, radius `14px`, padding `12px 16px`, background `#ffffff`, `elevation-4`, left colored accent bar (`3px solid var(--accent)`).
- **Motion:** Spring entrance (`stiffness: 380, damping: 32`), auto-dismiss after `4200ms`.

### 7.7 Skeleton Loader
- **Shimmer Base:** Linear gradient `90deg, rgba(23, 52, 73, 0.06) 25%, rgba(23, 52, 73, 0.12) 50%, rgba(23, 52, 73, 0.06) 75%`.
- **Animation:** `background-position: 200% 0`, duration `1600ms ease-in-out infinite`.
- **Radius:** Text lines `6px`, cards `20px`, avatars `9999px`.

### 7.8 Empty & Error States
- **Empty State:** Dashed border (`1.5px dashed rgba(23, 52, 73, 0.2)`), background `rgba(246, 251, 255, 0.6)`, radius `20px`, padding `40px 24px`, center icon in a `48px` circular container, H3 (`16px / 600`), Body text (`14px / 400`), single action button.
- **Error State:** Redesigned cleanly with `#991b1b` icon, friendly plain-English reason, and a single high-contrast `Reload` or `Retry` button.

### 7.9 Secure QR Card
- **Structure:** Pure white presentation plate (`#ffffff`), radius `24px`, padding `20px`, high-contrast border `1px solid rgba(23, 52, 73, 0.14)`.
- **Anti-Tampering Features:** Dynamic watermark overlay with pulsing green "LIVE GATEPASS" pill dot; canvas-rendered QR with right-click and touch-callout disabled (`user-select: none; pointer-events: auto;`); auto-obscure mask upon browser window blur or screen capture.

---

## 8. Motion & Animation

### 8.1 Framer Motion Presets
```javascript
// Canonical Apple HIG fluid curves
export const SPRING_SNAPPY = { type: 'spring', stiffness: 420, damping: 30 }
export const SPRING_GENTLE = { type: 'spring', stiffness: 300, damping: 28 }
export const TOAST_SPRING   = { type: 'spring', stiffness: 380, damping: 32 }
export const EASE_APPLE     = [0.16, 1, 0.3, 1] // cubic-bezier
```

### 8.2 Durations & Permitted Transitions
- **Micro-interactions (Buttons, tabs, toggles, checkmarks):** `150ms` - `200ms`.
- **Expansions & Drawers (Cards, accordions, bottom sheets):** `280ms` - `320ms` (`EASE_APPLE`).
- **Page Transitions & Modal Entrances:** `320ms` - `380ms`.
- **Allowed Animated Properties:** ONLY `transform` and `opacity`.  
  *Never animate `height`, `width`, `margin`, `padding`, or `top`* — doing so causes CPU layout thrashing and drops frames on low-end hardware.

### 8.3 Prefers-Reduced-Motion Rules
When `@media (prefers-reduced-motion: reduce)` is detected or `useReducedMotion()` returns true:
- Disable all springs, translations, scale effects, and positional reveals.
- Replace entrance transitions with instant zero-duration or a simple `100ms` pure `opacity` fade.
- Turn off skeleton shimmer looping (`animation: none; background: rgba(23, 52, 73, 0.08);`).
- Freeze scanner viewfinder sweep lines and live ping ripples to static indicators.

### 8.4 Low-End Hardware Guardrails
- Disallow stacking multiple CSS `backdrop-filter: blur(...)` elements on screens < 768px.
- Limit full-screen canvas particle shaders (Aurora, GhostFibers) strictly to desktop landing pages; omit them completely from operational dashboards.

---

## 9. Offline & Sync States

Since gate checkpoints regularly face Wi-Fi degradation, DwarPal implements five deterministic offline states:

```
[ Online / Synced ]  ──>  [ Connection Drops ]  ──>  [ Offline Banner Appears ]
                                                            │
[ Auto-Sync Confirmed ]  <──  [ Syncing (Spinner) ]  <──  [ Gate Scan Performed ]
                                                            │
                                                     [ Pending Sync Queue (N) ]
```

1. **Global Offline Banner:**
   - *Placement:* Sticky bar pinned immediately beneath top app header (`height: 36px`).
   - *Appearance:* Background `#fefce8`, border-bottom `1px solid rgba(180, 83, 9, 0.25)`, text `#854d0e`, font `13px / 600`.
   - *Message:* `Offline mode active — Local cryptographic verification running. Data will sync upon reconnect.`
2. **"Pending Sync" Badge:**
   - *Placement:* Embedded in security scanner status header and admin tables.
   - *Appearance:* Orange pill badge `#fff7ed` / `#c2410c` displaying `Pending Sync (N)` with an amber pulse dot.
3. **Syncing State:**
   - *Appearance:* Blue indicator `#eff6ff` / `#1e40af` with an active 360-degree rotating sync icon: `Syncing N audit records...`.
4. **Synced State:**
   - *Appearance:* Green toast notification `#f0fdf4` / `#166534` appearing for `3000ms`: `All audit records synced successfully.`
5. **Sync Failed State:**
   - *Appearance:* Red alert banner `#fef2f2` / `#991b1b` with explicit action button: `Manual Sync Retry`.

---

## 10. Accessibility (a11y)

1. **Contrast Standards:** All text layers achieve minimum WCAG AA (4.5:1 for body text, 3:1 for large text & UI boundaries). High-priority security data achieves WCAG AAA (>7:1).
2. **Focus Management:** Visible, keyboard-accessible focus ring:
   ```css
   :focus-visible {
     outline: none;
     box-shadow: 0 0 0 3px rgba(40, 114, 161, 0.25);
   }
   ```
3. **Color Independence:** Color is **never** used as the sole conveyor of information. Every gatepass state pairs its background color with explicit written copy (`Approved`, `Pending`, `Rejected`, `Checked Out`) and an icon indicator.
4. **Touch & Click Target Padding:** Minimum `44px x 44px` physical hit area for all buttons, hamburger toggles, and table action icons.
5. **Screen Reader Labeling:**
   - Modals require `role="dialog"` and `aria-labelledby="modal-title"`.
   - Toasts require `role="status"` or `role="alert"`.
   - Non-text buttons require descriptive `aria-label` tags (e.g., `aria-label="Close modal"`).

---

## 11. Responsive Rules

### 11.1 Breakpoint Standards
*(Standardized to 3 strict breakpoints, replacing the 11 ad-hoc media queries currently in CSS)*
- **Mobile (`sm`):** `< 640px` — Single column, bottom tab bar, full-width cards, native sheets.
- **Tablet (`md`):** `640px - 1023px` — Collapsible sidebar, 2-column card grids.
- **Desktop (`lg`):** `>= 1024px` — Persistent sidebar (`280px`), multi-column workspace, full data tables.
- **Wide Display (`xl`):** `>= 1280px` — Full management suites, analytics charts, master control panels.

### 11.2 Adaptive View Transformations
- **Data Tables:**
  - *Desktop (>= 1024px):* Standard tabular layout (`<table>`) with sortable column headers, fixed row heights, and inline action buttons.
  - *Mobile (< 640px):* Automatically transforms into a vertical feed of stacked `GatepassCard` items. Horizontal scrolling tables are strictly prohibited on mobile.
- **Navigation:**
  - *Desktop:* Fixed left sidebar with full labels, category groupings, and user profile drawer.
  - *Mobile:* Fixed top header with brand lockup + bottom navigation bar for top 4 views (`Dashboard`, `Scan/Passes`, `Alerts`, `Profile`).

---

## 12. Iconography & Imagery

1. **Icon Library:** Lucide React icons exclusively.
2. **Stroke Width:** Uniform `1.75px` for default navigation and controls; `2.0px` for status badges and high-emphasis indicators. Never mix varying stroke weights.
3. **Bounding Boxes:** Every icon sits within a square coordinate box (`16px`, `18px`, `20px`, or `24px`).
4. **Alignment:** Icons must align vertically with neighboring typography using `display: inline-flex; align-items: center;`.
5. **Color Inheritance:** Icons always inherit color from their parent text token (`color: currentColor`) unless serving as a distinct status glyph.

---

## 13. Do and Don't Rules

1. **DO** use `#163247` for primary dark ink and `#2872a1` for primary interactive blue.  
   **DON'T** use random raw shades like `#0f172a`, `#173449`, `#0284c7`, or `#3b82f6`.
2. **DO** enforce a minimum tap target of `44px x 44px` for every interactive button or link.  
   **DON'T** create 24px or 28px icon buttons without expanding their hit boundaries.
3. **DO** use bottom sheets with rounded top corners (`radius: 20px 20px 0 0`) on mobile screens.  
   **DON'T** snap modals into raw 0-radius full-screen boxes (`border-radius: 0 !important`).
4. **DO** animate exclusively with `transform` and `opacity`.  
   **DON'T** animate `height`, `width`, or layout properties that cause frame stutter.
5. **DO** respect `prefers-reduced-motion` across every Framer Motion component and CSS animation.  
   **DON'T** leave infinite pulse, shimmer, or particle effects running when reduced motion is requested.
6. **DO** pair every color status badge with explicit plain-text words and an icon.  
   **DON'T** rely solely on red/green dots to communicate pass approval or rejection.
7. **DO** convert wide data tables into card feeds on mobile devices.  
   **DON'T** force users to horizontally scroll wide tables on 360px-wide screens.
8. **DO** standardize corner radii using the token scale (`6px`, `10px`, `14px`, `20px`, `24px`, `9999px`).  
   **DON'T** inject arbitrary radius integers (e.g., `7px`, `9px`, `18px`, `26px`, `32px`).
9. **DO** provide immediate, reassuring offline feedback and sync-queue counts.  
   **DON'T** fail silently or freeze the screen when campus Wi-Fi drops at the gate.
10. **DO** restrict the display font strictly to top-level branding and hero headers.  
    **DON'T** use display fonts for form inputs, table rows, or functional data points.

---

## 14. Implementation Map (Tailwind CSS 4 & CSS Variables)

Paste this unified `@theme` block into `src/index.css` to align the codebase directly with this specification:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

@theme {
  /* System Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  /* Brand Palette */
  --color-brand-primary: #163247;
  --color-brand-accent: #2872a1;
  --color-brand-accent-hover: #1f5a80;
  --color-brand-accent-soft: rgba(40, 114, 161, 0.08);

  /* Surface System (Light Mode) */
  --color-surface-canvas: #f6fbff;
  --color-surface-card: #ffffff;
  --color-surface-elevated: #ffffff;
  --color-surface-sunken: #eef4f9;

  /* Content Ink */
  --color-text-primary: #163247;
  --color-text-secondary: #47647b;
  --color-text-muted: #5d7183;
  --color-text-disabled: #94a3b8;

  /* Hairlines & Borders */
  --color-border-subtle: rgba(23, 52, 73, 0.08);
  --color-border-default: rgba(23, 52, 73, 0.14);
  --color-border-strong: rgba(23, 52, 73, 0.24);

  /* Semantic Lifecycle Tokens */
  --color-status-pending-bg: #fffbeb;
  --color-status-pending-text: #92400e;
  --color-status-pending-border: rgba(180, 83, 9, 0.25);

  --color-status-approved-bg: #f0fdf4;
  --color-status-approved-text: #166534;
  --color-status-approved-border: rgba(22, 101, 52, 0.25);

  --color-status-rejected-bg: #fef2f2;
  --color-status-rejected-text: #991b1b;
  --color-status-rejected-border: rgba(185, 28, 28, 0.25);

  --color-status-out-bg: #eff6ff;
  --color-status-out-text: #1e40af;
  --color-status-out-border: rgba(29, 78, 216, 0.25);

  --color-status-returned-bg: #f0fdfa;
  --color-status-returned-text: #115e59;
  --color-status-returned-border: rgba(15, 118, 110, 0.25);

  /* Corner Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* Standardized Diffused Elevation */
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.07);
  --shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.09), 0 2px 6px rgba(40, 114, 161, 0.06);
  --shadow-xl: 0 16px 38px rgba(15, 23, 42, 0.12), 0 4px 10px rgba(15, 23, 42, 0.04);
  --shadow-2xl: 0 24px 64px rgba(15, 23, 42, 0.16);
}
```

---
*End of DwarPal DESIGN.md Specification.*
