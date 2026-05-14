# 3D Personal Learning Platform

A full-stack learning platform focused on 3D asset management, courses, and collaborative team environments.

## Project Overview

- **Frontend**: Vue 3 (Composition API, `<script setup>`), TypeScript, Vite, Tailwind CSS (v4), Pinia for state management.
- **Backend**: Node.js with Express, TypeScript, Prisma ORM.
- **Database**: SQLite (managed via Prisma).
- **Key Features**: 
  - 3D Model viewing and management (Three.js).
  - Learning management system (LMS) with courses, lessons, and progress tracking.
  - Team collaboration, project management, and task tracking.
  - Community features: discussions, showcases, and messaging.
  - Payment integration (Alipay) and subscription plans.
  - Authentication with 2FA support.

## Project Structure

### Frontend (`/src`)
- `components/`: Reusable UI components (Dialogs, Markdown Editor, Model Viewer).
- `views/`: Page-level components organized by feature (Admin, Auth, Community, Learning, etc.).
- `stores/`: Pinia stores for Auth, System settings, and Workspace state.
- `assets/`: Static assets like images and SVGs.
- `locales/`: i18n translation files (EN/CN).
- `router/`: Vue Router configuration.

### Backend (`/server`)
- `src/controllers/`: Logic for handling API requests.
- `src/routes/`: Express route definitions.
- `src/services/`: Integration with external services (Alipay, Prisma, Email, etc.).
- `src/middlewares/`: Auth, error handling, and file upload middlewares.
- `prisma/`: Database schema (`schema.prisma`) and migrations.
- `uploads/`: Local storage for user-uploaded assets (avatars, models, etc.).

## Getting Started

### Prerequisites
- Node.js (Latest LTS recommended)
- npm or pnpm

### Environment Setup
1. Copy `.env.example` to `.env` in the root directory.
2. Copy `server/.env.example` to `server/.env` and configure your database/API keys.

### Installation
```bash
# Install root/frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
```

### Running the Project

#### Frontend (Development)
```bash
npm run dev
```

#### Backend (Development)
```bash
cd server
npm run dev
```

#### Database (Prisma)
```bash
cd server
npx prisma generate
npx prisma migrate dev
```

## Development Conventions

- **Typing**: Use TypeScript strictly. Define interfaces/types for all API responses and component props.
- **Styling**: Prefer Tailwind CSS utility classes.
- **Naming**: 
  - Components: PascalCase (e.g., `ModelViewer.vue`).
  - Controllers/Routes: camelCase (e.g., `auth.controller.ts`).
- **Commits**: Follow Conventional Commits (e.g., `feat:`, `fix:`, `docs:`).

## Testing
- **Backend**: Test commands are available in `server/package.json` (currently a placeholder).
- **Frontend**: `vue-tsc` is used for type-checking during builds.
