Pages
- /login: GitHub sign-in via /api/auth?action=login
- /dashboard: Overview with metrics and Upload CTA
- /dashboard/api-keys: List/create/revoke API keys
- /dashboard/jobs: Job history (placeholder if backend missing)
- /dashboard/usage: Usage metrics (admin-only if backend enabled)

Components
- DashboardLayout: Sidebar + header shell, protects routes by checking session via /api/me then /api/auth?action=me
- LoginButton, LogoutButton
- ApiKeyCard, JobRow, StatCard

Styles
- Dark theme in src/styles/dashboard.css; imported via pages/_app.tsx