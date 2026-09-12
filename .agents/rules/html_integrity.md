# HTML Integrity & SPA Tab Structure Rules

## 1. Strict Sibling Scoping for Tab Containers
- In Alpine.js / SPA dashboards, every tab panel container (e.g., `x-show="activeAdminTab === '...'"` or similar) MUST be a direct sibling of other tab containers under the main dashboard container.
- When splitting, moving, or refactoring layout sections into tabs, ALWAYS verify HTML tag nesting and balance: ensure every opening `<div>` inside a tab panel is properly closed BEFORE the start of the next tab panel `<div>`.
- NESTING a tab container inside another tab container (e.g. nesting `activeAdminTab === 'tickets'` inside `activeAdminTab === 'all'`) causes Alpine.js `x-show` / `x-cloak` to hide all nested tabs whenever the outer tab is inactive, producing a completely blank screen.

## 2. Strict Adherence to Scope & Layout Directives
- Do NOT introduce unrequested overview or summary tabs (e.g., "Thống kê tổng quan") unless explicitly instructed by the user.
- When asked to move specific components (e.g., "Tất cả ticket") to a dedicated tab while keeping the rest unchanged ("còn lại giữ nguyên"), preserve the original main dashboard layout (`all`) intact without stripping core elements unless requested.

## 3. Mandatory Git Synchronization Before Edits
- Always check `git status` or pull the latest changes before starting large refactors to avoid overwriting code that has been updated externally or in another session.

## 4. Mandatory Post-Edit Integrity Checks
- When using tools to edit files (especially replacing large HTML chunks), you MUST carefully read the `git diff` output to guarantee that no orphaned HTML classes or broken unclosed tags were left behind. 
- Do not blindly assume automated replacements were 100% accurate without a diff review.
