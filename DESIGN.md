# DwarPal Design System Specification (DESIGN.md)

**Product:** DwarPal — Enterprise College Gatepass & Campus Access Management Platform  
**Target Quality:** Apple Human Interface Guidelines (HIG) Standard — Calm, Premium, Minimal, High-Precision  
**Specification Version:** 1.1.0 (Refined Canonical)  
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
1. **Student:** Requests movement pass; tracks real-time stage progression; presents gatepass QR code at exit gate *(offline caching requires backend support, not yet built)*.
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
3. **Depth & Elevation:** Layering is expressed through light-mode luminance shifts, clean 1px hairline borders (`rgba(23, 52, 73, 0.12)`), solid scrim backdrops on desktop, and diffused neutral shadows rather than heavy skeuomorphism or loud gradients.
4. **Consistency:** All 9 role portals share identical component structures, spacing grids, typographic scales, button radii (12px across all variants), and motion curves.
5. **Mobile-First Ergonomics:** Primary actions stay within the thumb reach zone (bottom 40% of mobile viewports). Dialogs transform into native-feel bottom sheets on mobile.
6. **Zero Jank on Low-End Phones:** Smooth 60fps animations limited strictly to GPU-accelerated `transform` and `opacity`. Stacking heavy `backdrop-filter: blur()` layers is strictly forbidden.

---

## 3. Color Tokens

### 3.1 Canonical Brand Foundations
- **Brand Ink / Primary Navy:** `#163247` *(changed from current inconsistent mix of #173449, #10263e, and #0f172a)*
- **Brand Accent / Electric Teal Blue:** `#2872a1` *(canonical interactive token)*
- **Brand Accent Hover / Deep Tone:** `#1f5a80`
- **Brand Canvas Light:** `#f6fbff` *(changed from current greenish #f4f7f1 to pure brand-harmonized ice tint)*

### 3.2 Exact Hex Values (Light & Dark Mode)

| Token Category | Token Name | Light Mode Hex | Dark Mode Hex | WCAG Contrast (vs Surface) |
| :--- | :--- | :--- | :--- | :--- |
| **Brand** | `--color-brand-primary` | `#163247` | `#5ba3d4` | > 12.0:1 (AAA) |
| | `--color-brand-accent` | `#2872a1` | `#3b93cc` | 4.7:1 (AA) |
| | `--color-brand-accent-hover`| `#1f5a80` | `#52a5dc` | 6.8:1 (AAA) |
| | `--color-brand-accent-soft` | `rgba(40, 114, 161, 0.08)` | `rgba(59, 147, 204, 0.16)` | Decorative / State |
| **Surfaces** | `--color-surface-canvas` | `#f6fbff` | `#0d1721` | Base background |
| | `--color-surface-card` | `#ffffff` | `#152232` | 1.1:1 elevation |
| | `--color-surface-elevated`| `#ffffff` | `#1c2c3f` | 1.2:1 modal / popover |
| | `--color-surface-sunken` | `#eef4f9` | `#081018` | Inset fields |
| | `--color-surface-overlay` | `rgba(15, 23, 42, 0.55)` | `rgba(0, 0, 0, 0.75)` | Solid scrim backdrop |
| **Text** | `--color-text-primary` | `#163247` | `#f0f6fc` | 12.1:1 (AAA) |
| | `--color-text-secondary` | `#47647b` | `#9bb2c6` | 5.8:1 (AA) |
| | `--color-text-muted` | `#5d7183` | `#72899d` | 4.6:1 (AA) |
| | `--color-text-disabled` | `#94a3b8` | `#485d70` | 3.0:1 (Disabled text) |
| | `--color-text-inverse` | `#ffffff` | `#0d1721` | High contrast |
| **Borders** | `--color-border-subtle` | `rgba(23, 52, 73, 0.08)` | `rgba(255, 255, 255, 0.08)` | Hairline dividers |
| | `--color-border-default` | `rgba(23, 52, 73, 0.14)` | `rgba(255, 255, 255, 0.16)` | Card / input border |
| | `--color-border-strong` | `rgba(23, 52, 73, 0.24)` | `rgba(255, 255, 255, 0.28)` | Focus / active control |
| | `--color-border-focus` | `#2872a1` | `#5ba3d4` | 2px solid outline (offset 2px) |

### 3.3 Semantic & Gatepass Lifecycle Status Colors

| Gatepass Stage / Semantic State | Light BG | Light Border | Light Text | Dark BG | Dark Text | Meaning & Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Pending / Submitted** | `#fffbeb` | `rgba(180, 83, 9, 0.25)` | `#92400e` | `rgba(245, 158, 11, 0.12)` | `#fcd34d` | Awaiting mentor, HOD, or Principal review. |
| **Approved** | `#f0fdf4` | `rgba(22, 101, 52, 0.25)` | `#166534` | `rgba(34, 197, 94, 0.12)` | `#86efac` | Pass granted; active QR ready for gate exit. |
| **Rejected / Cancelled** | `#fef2f2` | `rgba(185, 28, 28, 0.25)` | `#991b1b` | `rgba(239, 68, 68, 0.12)` | `#fca5a5` | Request declined or student canceled. |
| **Checked Out ("Out")** | `#eff6ff` | `rgba(29, 78, 216, 0.25)` | `#1e40af` | `rgba(59, 130, 246, 0.12)` | `#93c5fd` | Scanned at exit gate; timer actively running. |
| **Completed ("Returned")** | `#f0fdfa` | `rgba(15, 118, 110, 0.25)` | `#115e59` | `rgba(20, 184, 166, 0.12)` | `#5eead4` | Scanned back into campus; pass archived. |
| **Emergency / Critical Out** | `#fff1f2` | `rgba(190, 18, 60, 0.28)` | `#9f1239` | `rgba(244, 63, 94, 0.14)` | `#fda4af` | Emergency medical / parent summon pass. |

*Contrast Guarantee:* All badge text-to-background combinations meet or exceed WCAG AA (minimum 4.5:1 ratio).

### 3.4 Role Badge Neutral Styling & Status Color Discipline
- **Rule of Color Reservation:** Chromatic colors are reserved **strictly for gatepass lifecycle status**. Role badges do **NOT** use colored background pills.
- **Universal Role Badge Style:** Every role badge is rendered in neutral styling:  
  `background: rgba(23, 52, 73, 0.06); color: #163247; border: 1px solid rgba(23, 52, 73, 0.12);`  
  (Dark mode: `background: rgba(255, 255, 255, 0.08); color: #f0f6fc; border-color: rgba(255, 255, 255, 0.14);`).
- Each badge includes a designated Lucide icon (`GraduationCap` for Student, `BookOpen` for Faculty, `ShieldCheck` for HOD/Principal, `KeyRound` for Security, `Sliders` for Admin).
- **Optional Micro Indicator Dot (6px):** If role differentiation is required in dense tables or profile headers, it is restricted to a small 6px circular dot beside the text:
  - Student: `#16a34a`
  - Faculty: `#2563eb`
  - Academic HOD: `#d97706`
  - Principal: `#b45309`
  - CAO: `#7c3aed`
  - Security & Bouncer: `#2872a1` *(unified with primary brand blue; eliminates conflicting rogue sky tokens)*
  - Admin: `#2872a1`
  - IT / Owner: `#0d9488`
  - Chairman / Director: `#4f46e5`

---

## 4. Typography

### 4.1 Font Stacks & Font Delivery
- **Font Delivery:** **Inter** is the primary font, self-hosted (WOFF2 format), latin subset, variable weight (`wght 100 900`), loaded with `font-display: swap`.
- **Primary Text & Body Font Stack:** `"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Display Font Stack:** `"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", sans-serif`
- **Monospace Stack:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`

### 4.2 Display Font Usage Rules
The Display font styling is permitted **ONLY** on:
1. Product branding locks (`DwarPal` logo wordmark).
2. Primary dashboard splash greetings (e.g., `Good Morning, Prof. Sharma`).
3. Gatepass scan status modal verdicts (`PASS VALID / CLEARED FOR EXIT`).
4. Auth hero title headings.
*Strict Prohibition:* The Display font is **FORBIDDEN** for data tables, lists, inputs, metadata chips, modal body text, or button labels.

### 4.3 Type Scale Table

| Role / Style | Size | Weight | Line Height | Letter Spacing | Target Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Large** | `32px` (`2.0rem`) | `700` (Bold) | `38px` (`1.2`) | `-0.025em` | Auth hero headline, Gate cleared status |
| **Display Medium** | `26px` (`1.625rem`)| `700` (Bold) | `32px` (`1.25`) | `-0.02em` | Main dashboard page header (H1) |
| **Title 1** | `22px` (`1.375rem`)| `600` (SemiBold) | `28px` (`1.3`) | `-0.015em` | Panel titles, modal primary header |
| **Title 2** | `18px` (`1.125rem`)| `600` (SemiBold) | `24px` (`1.35`) | `-0.01em` | Section headers, card group titles |
| **Headline** | `16px` (`1.0rem`) | `600` (SemiBold) | `22px` (`1.4`) | `-0.005em` | Card titles, gatepass reason, student name |
| **Input / Select Text**| **`16px` (`1.0rem`)** | `400` (Regular) | `24px` (`1.5`) | `0` | **Mandatory form field values (prevents iOS Safari focus zoom)** |
| **Body Default** | `15px` (`0.9375rem`)| `400` (Regular) | `22px` (`1.47`) | `0` | Primary table cells, descriptions, form text |
| **Body Medium** | `15px` (`0.9375rem`)| `500` (Medium) | `22px` (`1.47`) | `0` | Emphasized body text, table summary values |
| **Callout** | `14px` (`0.875rem`)| `600` (SemiBold) | `20px` (`1.43`) | `0` | Button text, action items, tab items |
| **Subheadline** | `13px` (`0.8125rem`)| `400` (Regular) | `18px` (`1.38`) | `+0.005em` | Secondary metadata lines, timestamps |
| **Caption 1** | `12px` (`0.75rem`) | `500` (Medium) | `16px` (`1.33`) | `+0.01em` | Form field labels, table headers, tags |
| **Caption 2 (Micro)**| `11px` (`0.6875rem`)| `700` (Bold) | `14px` (`1.27`) | `+0.05em` (UPPER) | Eyebrow badges, live ping pills, status dots |

---

## 5. Spacing Scale & Layout Grid

### 5.1 The 4/8 Grid Scale
All layouts, margins, gutters, and paddings derive strictly from the following scale:
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

| Token | Value | Specific Component Application |
| :--- | :--- | :--- |
| `--radius-sm` | `6px` | Inline micro tags, status badge indicators, verification check-boxes |
| `--radius-md` | `10px` | Form inputs, select dropdowns, search bar, segmented controls, tooltips |
| **`--radius-btn`** | **`12px`** | **Universal button radius (applies to ALL button variants)** |
| `--radius-lg` | `14px` | Toast notifications, summary cards, filter tabs |
| `--radius-xl` | `20px` | Gatepass cards, admin panels, bottom sheet top corners, dialog cards |
| `--radius-2xl` | `24px` | Auth container card, student QR presentation frame |
| `--radius-full` | `9999px` | Avatars, status pills, circular icon buttons, toggle pills |

### 6.2 Elevation & Shadow Hierarchy
- **Elevation 0 (Flat):** `box-shadow: none; border: 1px solid var(--color-border-default);`
- **Elevation 1 (Inset / Rest Cards):**  
  `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.04);`
- **Elevation 2 (Interactive Cards & Action Buttons):**  
  `box-shadow: 0 4px 12px rgba(15, 23, 42, 0.07);`
- **Elevation 3 (Hover State, Active Popovers, Sticky Topbar Scrolled):**  
  `box-shadow: 0 8px 24px rgba(15, 23, 42, 0.09), 0 2px 6px rgba(40, 114, 161, 0.06);`
- **Elevation 4 (Toasts, Floating Modals, Mobile Drawers):**  
  `box-shadow: 0 16px 38px rgba(15, 23, 42, 0.12), 0 4px 10px rgba(15, 23, 42, 0.04);`
- **Elevation 5 (System Modals & Scanner Overlay):**  
  `box-shadow: 0 24px 64px rgba(15, 23, 42, 0.16);`

---

## 7. Component Specifications

### 7.1 Action Buttons
Four distinct semantic variants with strict state management and a unified **`12px` border-radius**:
1. **Primary Button:**
   - *Style:* Background `#2872a1` (linear-gradient to `#1f5a80`), color `#ffffff`, border `1px solid rgba(31, 90, 128, 0.25)`, radius `12px`.
   - *Hover:* Background `#1f5a80`, shadow `elevation-3` *(no translateY hover lift)*.
   - *Pressed:* `transform: scale(0.98); background: #194766;`.
   - *Focus:* `outline: 2px solid #2872a1; outline-offset: 2px;` (dark mode: `outline-color: #5ba3d4;`).
   - *Disabled:* `opacity: 0.5; pointer-events: none; transform: none; box-shadow: none;`.
2. **Secondary Button:**
   - *Style:* Background `#ffffff`, color `#163247`, border `1px solid rgba(23, 52, 73, 0.14)`, radius `12px`.
   - *Hover:* Background `#f6fbff`, border-color `rgba(40, 114, 161, 0.3)`.
   - *Pressed:* `transform: scale(0.98); background: #eef4f9;`.
3. **Tertiary / Ghost Button:**
   - *Style:* Background `transparent`, color `#47647b`, border `none`, radius `12px`.
   - *Hover:* Background `rgba(40, 114, 161, 0.08)`, color `#163247`.
   - *Pressed:* `transform: scale(0.98); background: rgba(40, 114, 161, 0.14);`.
4. **Destructive / Reject Button:**
   - *Style:* Background `#fef2f2`, color `#991b1b`, border `1px solid rgba(185, 28, 28, 0.22)`, radius `12px`.
   - *Hover:* Background `#fee2e2`, color `#7f1d1d`.
   - *Pressed:* `transform: scale(0.98); background: #fecaca;`.
5. **Button Loading State:**
   - Visual: Retains exact button width to prevent layout shift. Content is replaced or prepended with a 16px circular spinner:
     ```css
     .btn-spinner {
       width: 16px;
       height: 16px;
       border: 2px solid rgba(255, 255, 255, 0.3);
       border-top-color: currentColor;
       border-radius: 50%;
       animation: btn-spin 600ms linear infinite;
     }
     @keyframes btn-spin {
       to { transform: rotate(360deg); }
     }
     ```
   - Interaction: `pointer-events: none; cursor: wait; opacity: 0.85;`.
- **Button Sizing:**
  - *Large (Primary Viewport CTA):* Height `48px`, font `15px / 600`, padding `0 20px`.
  - *Standard (Card / Row CTA):* Height `44px`, font `14px / 600`, padding `0 16px`.
  - *Compact (Table inline):* Height `36px` (hit-box padded to 44px via `::after`), font `13px / 600`, padding `0 12px`.

### 7.2 Inputs & Select Fields
- **Container Structure:** Inset label or top label (Caption 1: `12px / 500`, uppercase, `#47647b`).
- **Input & Select Field:** Height `46px`, padding `0 14px`, border `1px solid rgba(23, 52, 73, 0.14)`, radius `10px`, background `#ffffff`, text `#163247`.
- **Mandatory 16px Font Size:** `font: 400 16px / 1.5 "Inter", sans-serif;` **Strict requirement to eliminate automatic iOS Safari viewport zoom on focus.**
- **States:**
  - *Hover:* Border-color `rgba(40, 114, 161, 0.35)`.
  - *Focus:* Border-color `#2872a1`, `outline: 2px solid #2872a1; outline-offset: 2px;` (dark mode: `outline-color: #5ba3d4;`).
  - *Invalid / Error:* Border-color `#ef4444`, `outline: 2px solid #ef4444; outline-offset: 2px;`.
  - *Disabled:* Background `#eef4f9`, color `#94a3b8`, cursor `not-allowed`.
- **Select Dropdowns:** Chevron right icon (`18px`) rotated `90deg` down; native mobile pickers preserved for instant accessibility.

### 7.3 Gatepass Card & Expandable Card
The core transactional surface of DwarPal:
- **Card Shell:** Background `#ffffff`, border `1px solid rgba(23, 52, 73, 0.12)`, radius `20px`, padding `16px 18px`, `elevation-1`.
- **Header:** Eyebrow (`11px / 700` uppercase: `STUDENT GATEPASS`), Gatepass ID (`14px / 700` mono: `GP-2026-8941`), StatusBadge aligned right.
- **Body:** Reason (`16px / 600` `#163247`), Requester Meta (`13px / 400` `#47647b`), Out/Return Window with Clock icon (`13px / 500`).
- **Interaction States:**
  - *Hover:* `box-shadow: var(--shadow-md); border-color: rgba(40, 114, 161, 0.25);` *(no translateY hover lift; no 2px top border).*
  - *Pressed:* Background tint `rgba(40, 114, 161, 0.03)` / `#f8fbfe` for immediate tactile touch feedback.
- **Expansion Panel (Framer Motion / CSS Grid):** Smooth expansion revealing detailed audit trail timeline, approver signatures, vehicle number, and action button bar. Card expansion may use CSS `grid-template-rows: 0fr` to `1fr` transition or Framer Motion layoutId.

### 7.4 Status Badges & Neutral Role Badges
- **Status Badges:** Pill shape (`border-radius: 9999px`), padding `4px 10px`, typography `11px / 700` uppercase, tracking `+0.04em`. Includes a 6px circular dot (`background: currentColor; opacity: 0.8; margin-right: 5px;`). Uses semantic lifecycle colors (Pending, Approved, Rejected, Out, Returned, Emergency).
- **Role Badges:** Strictly neutral (`background: rgba(23, 52, 73, 0.06); color: #163247; border: 1px solid rgba(23, 52, 73, 0.12);`) paired with a Lucide role icon. No colored Principal/HOD backgrounds.

### 7.5 Bottom Sheet & Desktop Modal System
- **Desktop Modal:** Centered dialog, max-width `560px`, radius `20px`, padding `24px`, background `#ffffff`, `elevation-5`.  
  **Solid Scrim Backdrop:** `rgba(15, 23, 42, 0.55)` *(no backdrop-filter blur; solid scrim eliminates compositor lag on all desktop browsers).*
- **Mobile Bottom Sheet:** On viewports `< 640px`, all modals anchor to the viewport bottom with top radii `20px 20px 0 0`. Includes a `36px x 4px` rounded grab handle at top center (`background: rgba(23, 52, 73, 0.2); margin: 0 auto 12px;`).

### 7.6 Toast Notifications
- **Position:** Top-right on desktop (`top: 20px; right: 20px;`), top-center on mobile (`top: 12px; inset-inline: 16px;`).
- **Structure:** Width `min(380px, 100%)`, radius `14px`, padding `12px 16px`, background `#ffffff`, `elevation-4`, left colored accent bar (`3px solid var(--accent)`).
- **Motion:** Spring entrance (`stiffness: 380, damping: 32`), auto-dismiss after `4200ms`.

### 7.7 Skeleton Loader
- **Shimmer Implementation:** Must animate a pseudo-element (`::after`) with GPU-accelerated `transform: translateX(-100%)` to `transform: translateX(100%)`, duration `1500ms ease-in-out infinite`.  
  *Animating `background-position` is strictly forbidden due to mobile CPU repaint cost.*
  ```css
  .dp-skeleton {
    position: relative;
    overflow: hidden;
    background: rgba(23, 52, 73, 0.06);
    border-radius: var(--radius-sm);
  }
  .dp-skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    animation: dp-shimmer-slide 1.5s infinite;
  }
  @keyframes dp-shimmer-slide {
    100% { transform: translateX(100%); }
  }
  ```

### 7.8 Empty & Error States
- **Empty State:** Dashed border (`1.5px dashed rgba(23, 52, 73, 0.2)`), background `rgba(246, 251, 255, 0.6)`, radius `20px`, padding `40px 24px`, center icon in a `48px` circular container, H3 (`16px / 600`), Body text (`14px / 400`), single action button.
- **Error State:** Clean icon `#991b1b`, clear plain-English explanation, and a single high-contrast `Reload` or `Retry` button.

### 7.9 Secure QR Card
- **Structure:** Pure white presentation plate (`#ffffff`), radius `24px`, padding `20px`, high-contrast border `1px solid rgba(23, 52, 73, 0.14)`.
- **Anti-Tampering Features:**
  - Watermark overlay with pulsing green "LIVE GATEPASS" pill dot.
  - Canvas-rendered QR with right-click and touch-callout disabled (`user-select: none; pointer-events: auto;`).
  - *(Requires backend support, not yet built):* Offline cached QR verification tokens.
  - *(Requires backend support, not yet built):* System-level screenshot capture detection and automatic obscurity mask.

### 7.10 Bottom Tab Bar (Mobile Navigation)
- **Bar Height:** `56px` + safe-area inset (`padding-bottom: max(8px, env(safe-area-inset-bottom))`).
- **Container:** Background `#ffffff` (dark: `#152232`), border-top `1px solid rgba(23, 52, 73, 0.12)`, fixed bottom, z-index `40`.
- **Tab Layout:** 4 items (`Dashboard`, `Scan/Passes`, `Alerts`, `Profile`) evenly distributed across viewport width.
- **Icon Size:** `20px x 20px`.
- **Label Size:** `11px / 500` font size.
- **Active State:** Icon and label color `#2872a1` (dark: `#5ba3d4`), font-weight `600`, with top indicator line (`height: 2px; background: #2872a1;`).
- **Inactive State:** Icon and label color `#5d7183` (dark: `#72899d`), font-weight `400`.

### 7.11 Desktop Sidebar
- **Width:** `280px` fixed, sticky `top: 0`, height `100vh`.
- **Container:** Background `#ffffff` (dark: `#152232`), border-right `1px solid rgba(23, 52, 73, 0.12)`, padding `16px 12px`, display flex column.
- **Navigation Item:** Height `44px` (strict touch/click target), padding `0 12px`, border-radius `10px`, gap `10px`, typography `14px / 500`.
- **Item States:**
  - *Default:* Text `#47647b`, background `transparent`.
  - *Hover:* Background `rgba(40, 114, 161, 0.06)`, text `#163247`.
  - *Active:* Background `linear-gradient(135deg, #2872a1, #1f5a80)`, text `#ffffff`, font-weight `600`, box-shadow `0 2px 8px rgba(40, 114, 161, 0.2)`.

### 7.12 Segmented Control
- **Container:** Height `36px` (compact) or `42px` (standard), padding `3px`, background `#eef4f9` (dark: `#0d1721`), border-radius `10px`, border `1px solid rgba(23, 52, 73, 0.08)`.
- **Segments:** Equal width, height `100%`, display inline-flex center, typography `13px / 500`, text `#5d7183`, cursor `pointer`.
- **Active Segment:** Background `#ffffff` (dark: `#1c2c3f`), text `#163247` (dark: `#f0f6fc`), font-weight `600`, border-radius `8px`, box-shadow `0 1px 3px rgba(15, 23, 42, 0.08)`. Animated via Framer Motion `layoutId="segmented-indicator"`.

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
- **Permitted Animated Properties:** ONLY `transform` and `opacity`.  
  *Never animate height, width, margin, padding, or top.*  
  **EXPLICIT EXCEPTION:** Card and accordion expansion may animate CSS `grid-template-rows: 0fr` to `1fr` (or Framer Motion layoutId with overflow-hidden container) for smooth, jank-free height reveals without manual height recalculations.

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

Gate checkpoints regularly experience intermittent Wi-Fi connectivity. DwarPal implements five deterministic offline states:

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
   - *Message:* `Offline mode active — Local verification (requires backend support, not yet built). Stored passes remain viewable.`
2. **"Pending Sync" Badge:**
   - *Placement:* Embedded in security scanner status header and admin tables.
   - *Appearance:* Orange pill badge `#fff7ed` / `#c2410c` displaying `Pending Sync (N)` with an amber pulse dot.
3. **Syncing State:**
   - *Appearance:* Blue indicator `#eff6ff` / `#1e40af` with an active 360-degree rotating sync icon: `Syncing N audit records...`.
4. **Synced State:**
   - *Appearance:* Green toast notification `#f0fdf4` / `#166534` appearing for `3000ms`: `All audit records synced successfully.`
5. **Sync Failed State:**
   - *Appearance:* Red alert banner `#fef2f2` / `#991b1b` with explicit action button: `Manual Sync Retry`.
- **Note on Offline Verification:** Offline cryptographic token verification and offline caching require backend cryptography service integration (not yet built); current offline mode functions via browser IndexedDB/LocalStorage queued requests.

---

## 10. Accessibility (a11y)

1. **Contrast Standards:** All text layers achieve minimum WCAG AA (4.5:1 for body text, 3:1 for large text & UI boundaries). High-priority security data achieves WCAG AAA (>7:1).
2. **Focus Management:** Visible, solid keyboard-accessible focus ring:
   ```css
   :focus-visible {
     outline: 2px solid #2872a1;
     outline-offset: 2px;
   }
   @media (prefers-color-scheme: dark) {
     :focus-visible {
       outline-color: #5ba3d4;
     }
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
- **Mobile (`sm`):** `< 640px` — Single column, bottom tab bar (56px), full-width cards, native sheets.
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
   **DON'T** use random raw shades like `#0f172a`, `#173449`, or arbitrary secondary blues (`#3b82f6`).
2. **DO** set all form inputs and select elements to `16px` font size.  
   **DON'T** use `14px` or `15px` on mobile inputs (triggers disruptive iOS Safari auto-zoom).
3. **DO** apply `outline: 2px solid #2872a1; outline-offset: 2px` on focus.  
   **DON'T** use low-opacity or translucent focus rings that fail accessibility inspection.
4. **DO** maintain a unified `12px` border-radius across all button variants.  
   **DON'T** mix different radii (e.g., 10px on secondary, 14px on primary).
5. **DO** keep role badges strictly neutral (`background: rgba(23, 52, 73, 0.06); color: #163247`).  
   **DON'T** use colored pill badges for roles (Principal, HOD); color is reserved strictly for gatepass lifecycle status.
6. **DO** use solid scrim backdrops (`rgba(15, 23, 42, 0.55)`) on desktop modals.  
   **DON'T** apply `backdrop-filter: blur(...)` to modals (causes compositor stutter).
7. **DO** animate shimmer via a pseudo-element using `transform: translateX`.  
   **DON'T** animate `background-position` for skeleton loaders.
8. **DO** use tactile `transform: scale(0.98)` for button pressed states.  
   **DON'T** add hover `translateY` lifts or 2px top borders to gatepass cards or primary buttons.
9. **DO** convert wide data tables into card feeds on mobile devices.  
   **DON'T** force users to horizontally scroll wide tables on 360px-wide screens.
10. **DO** provide immediate, reassuring offline feedback and sync-queue counts.  
    **DON'T** present offline cryptographic verification as working before backend crypto support is deployed.

---

## 14. Implementation Map (Tailwind CSS 4 & CSS Variables)

> **Important:** Paste **only the `@theme` block below** into `src/index.css`. Do NOT paste the `@import` lines (as `src/index.css` already imports Tailwind layers).

```css
@theme {
  /* System Typography — Inter first (self-hosted, variable, swap) */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-display: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", sans-serif;
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
  --color-surface-overlay: rgba(15, 23, 42, 0.55);

  /* Surface System (Dark Mode Variables) */
  --color-surface-canvas-dark: #0d1721;
  --color-surface-card-dark: #152232;
  --color-surface-elevated-dark: #1c2c3f;
  --color-surface-sunken-dark: #081018;
  --color-surface-overlay-dark: rgba(0, 0, 0, 0.75);

  /* Content Ink (Light Mode) */
  --color-text-primary: #163247;
  --color-text-secondary: #47647b;
  --color-text-muted: #5d7183;
  --color-text-disabled: #94a3b8;

  /* Content Ink (Dark Mode) */
  --color-text-primary-dark: #f0f6fc;
  --color-text-secondary-dark: #9bb2c6;
  --color-text-muted-dark: #72899d;
  --color-text-disabled-dark: #485d70;

  /* Hairlines & Borders */
  --color-border-subtle: rgba(23, 52, 73, 0.08);
  --color-border-default: rgba(23, 52, 73, 0.14);
  --color-border-strong: rgba(23, 52, 73, 0.24);
  --color-border-focus: #2872a1;
  --color-border-focus-dark: #5ba3d4;

  /* Semantic Lifecycle Tokens (Light Mode) */
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

  --color-status-emergency-bg: #fff1f2;
  --color-status-emergency-text: #9f1239;
  --color-status-emergency-border: rgba(190, 18, 60, 0.28);

  /* Semantic Lifecycle Tokens (Dark Mode) */
  --color-status-pending-bg-dark: rgba(245, 158, 11, 0.12);
  --color-status-pending-text-dark: #fcd34d;
  --color-status-pending-border-dark: rgba(245, 158, 11, 0.3);

  --color-status-approved-bg-dark: rgba(34, 197, 94, 0.12);
  --color-status-approved-text-dark: #86efac;
  --color-status-approved-border-dark: rgba(34, 197, 94, 0.3);

  --color-status-rejected-bg-dark: rgba(239, 68, 68, 0.12);
  --color-status-rejected-text-dark: #fca5a5;
  --color-status-rejected-border-dark: rgba(239, 68, 68, 0.3);

  --color-status-out-bg-dark: rgba(59, 130, 246, 0.12);
  --color-status-out-text-dark: #93c5fd;
  --color-status-out-border-dark: rgba(59, 130, 246, 0.3);

  --color-status-returned-bg-dark: rgba(20, 184, 166, 0.12);
  --color-status-returned-text-dark: #5eead4;
  --color-status-returned-border-dark: rgba(20, 184, 166, 0.3);

  --color-status-emergency-bg-dark: rgba(244, 63, 94, 0.14);
  --color-status-emergency-text-dark: #fda4af;
  --color-status-emergency-border-dark: rgba(244, 63, 94, 0.35);

  /* Corner Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-btn: 12px;
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
