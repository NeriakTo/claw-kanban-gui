# PRD: Claw Kanban Cloud (SaaS Platform)

This document outlines the product requirements for the cloud-based version of the Claw Kanban service.

## 1. Product Vision
To provide all users of OpenClaw Agents with a cross-device, "anytime, anywhere" task tracking and management platform, enabling them to intuitively understand what their AI assistants are working on at all times.

## 2. Target Audience
-   **Core Users**: Individuals who own one or more OpenClaw Agent instances and assign tasks to them remotely via channels like chat apps.
-   **Extended Users**: Teams or individuals who wish to share their Agent's workflow and progress with others.

## 3. Core Features (MVP)

### 3.1 User Authentication (P0)
-   Users must be able to sign up and log in using an email and password.
-   A "Forgot Password" feature must be available.
-   (P1) Support for OAuth login via third-party providers like GitHub or Google.

### 3.2 API Key Management (P0)
-   After logging in, users must be able to generate, view, and revoke their personal API Keys from a settings page.
-   Each account should be able to have multiple API Keys, with a field for adding notes to each key (e.g., "Home Mac Mini Agent," "Cloud Server Agent").

### 3.3 Kanban Board Core (P0)
-   The web UI must provide a Kanban view with standard columns (Backlog, In Progress, Review, Done, Failed).
-   The board must display task cards pushed from the plugin API in real-time (or near real-time).
-   Cards must display all core information: title, tags, subtasks, progress, progress logs, and failure reasons.
-   (P1) Users should have the ability to manually drag and drop cards to change task status (requires API support).
-   (P1) Implement search and filtering capabilities (by title, tags, status, etc.).

### 3.4 API Endpoints (P0)
-   A secure RESTful API endpoint that requires API Key authentication must be provided.
-   It must support, at a minimum, operations compatible with the `kanban_update` tool, such as `POST /api/v1/tasks` (for create) and `PUT /api/v1/tasks/:id` (for update).

### 3.5 Billing & Subscription (P2 - Post-MVP)
-   Integration with a payment platform like Stripe or Lemon Squeezy.
-   Offer at least two tiers:
    -   **Free Tier**: Limited functionality (e.g., max 20 active tasks, 7-day log retention).
    -   **Pro Tier**: Paid subscription to unlock all limitations and access premium features.

## 4. Tech Stack Suggestions
-   **Frontend**: Next.js / React (deployable on Vercel, Netlify).
-   **Backend**: Can be Node.js/Express, Next.js API Routes, or a Backend-as-a-Service platform.
-   **Database**: **Supabase (PostgreSQL)** is highly recommended as it comes with built-in user authentication and real-time capabilities.
-   **UI Library**: Shadcn/UI, Tailwind CSS.
-   **Payment**: Stripe / Lemon Squeezy.

---
*This PRD was drafted by an OpenClaw agent.*
