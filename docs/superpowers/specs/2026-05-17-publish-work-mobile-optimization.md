# Publish/Upload Work Page Mobile Optimization Design Spec

Optimizing `PublishWorkDialog.vue` for mobile devices to ensure a seamless and functional experience on smaller screens.

## 1. Problem Statement
The current "Publish/Upload Work" dialog uses fixed-width percentages, large desktop-centric paddings, and multi-column layouts that break or become unusable on mobile devices (e.g., `grid-cols-2`, `w-[40%]`, `p-8`).

## 2. Proposed Changes

### 2.1 Dialog Container
- **Paddings**: Reduce `p-8` to `p-4` or `p-5` on mobile.
- **Max Width**: Adjust `max-w-[80vw]` to `max-w-full` or `w-[calc(100%-2rem)]` on mobile to utilize more screen space.
- **Border Radius**: Reduce `rounded-3xl` to `rounded-2xl` on mobile for a tighter fit.

### 2.2 Navigation (Tabs)
- **Category Tabs**: Currently using `flex-1` which squeezes text on narrow screens.
- **Adjustment**: Change container to `flex overflow-x-auto whitespace-nowrap scrollbar-hide` and remove `flex-1` from buttons to allow them to maintain a minimum readable width.

### 2.3 Layout Stacking
- **3D Model / Asset Upload**: Switch `grid-cols-2` to `grid-cols-1` on mobile (`grid-cols-1 md:grid-cols-2`).
- **Creative Work Showcase**: 
  - Change `flex gap-6` to `flex flex-col md:flex-row gap-6`.
  - Remove fixed `w-[40%]` and `w-[60%]` on mobile, replacing them with `w-full md:w-[40%]` and `w-full md:w-[60%]`.
  - Ensure the "Right side" (Markdown editor) properly stacks below the "Left side" form.

### 2.4 Component Adjustments
- **MarkdownEditor**: 
  - Ensure it takes `w-full`. 
  - Adjust height dynamically: `height="300px"` on mobile vs `height="500px"` on desktop.
- **Work Type Buttons**: The row of type buttons (`IMAGE`, `VIDEO`, etc.) should be scrollable or wrap gracefully. Currently, they use `flex-1` which makes them too small on mobile. Change to a wrapping grid or scrollable row.
- **Upload Areas**: Ensure `h-32` and `h-24` are responsive or slightly reduced for mobile to save vertical space.

## 3. Implementation Plan

### Phase 1: Container & Global Styles
- Update the main dialog `div` with responsive classes: `p-5 md:p-8`, `max-w-[95vw] md:max-w-[80vw]`.

### Phase 2: Category-Specific Layouts
- **Model/Asset**: Replace `grid grid-cols-2 gap-6` with `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`.
- **Work**: Replace `flex gap-6` and fixed `w-[40%]` with `flex flex-col md:flex-row gap-6` and `w-full md:w-[40%]`.

### Phase 3: Fine-Tuning
- Use conditional `height` for `MarkdownEditor` based on screen size or simply use a more flexible CSS-based approach if possible.
- Update Tailwind classes for font sizes and margins to be tighter on mobile.

## 4. Success Criteria
- The dialog fits comfortably on a 375px wide screen without horizontal overflow.
- All form fields and upload buttons are easily clickable.
- The Markdown editor is usable without making the dialog impossibly long.
