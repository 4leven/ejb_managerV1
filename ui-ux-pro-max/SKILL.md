---
name: ui-ux-pro-max
description: UI/UX design intelligence for designing, building, reviewing, and fixing web, mobile, and desktop interfaces, including accessibility, responsive layout, typography, color, motion, components, and React implementation.
---

# UI/UX Pro Max

Use the bundled local catalog to make coherent, evidence-based interface decisions. Treat catalog results as recommendations and preserve the user's product, stack, scope, and repository rules.

## Workflow

1. Identify product type, audience, platform, visual tone, and implementation stack.
2. For a new page or system-wide direction, run `python scripts/search.py "<2-5 focused terms>" --design-system -p "<project>"`.
3. For one concern, use a single verified domain search such as `--domain ux`, `style`, `color`, `typography`, or `icons`.
4. For implementation guidance, use a separate `--stack react` or other detected stack query.
5. Verify the returned category and applicability before using it. Retry once with a narrower query when results are empty or off-topic.
6. When Python is unavailable, read `templates/base/quick-reference.md` completely and use its prioritized checklist without inventing catalog results.

## Required quality checks

- Preserve visible keyboard focus and accessible names for icon-only controls.
- Maintain at least 4.5:1 contrast for normal text and never use color as the only status indicator.
- Use a consistent SVG icon family, semantic tokens, an 4/8px spacing rhythm, and predictable elevation.
- Prevent horizontal scrolling and nested-scroll conflicts; prioritize core content on small screens.
- Keep pointer targets at least 24x24 CSS px on web and provide comfortable spacing.
- Prefer transform/opacity for motion, support `prefers-reduced-motion`, and avoid layout-shifting effects.
- Give loading, empty, disabled, error, hover, active, and focus states clear feedback.
- Verify the result at small-phone, tablet, and desktop widths and in both supported themes.

The full generated instruction template is in `templates/base/skill-content.md`; detailed local datasets are under `data/`, and the search engine is `scripts/search.py`.
