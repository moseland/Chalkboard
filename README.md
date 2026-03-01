# Chalkboard

Chalkboard is a standalone, real-time collaborative whiteboard featuring an infinite canvas and AI integration.

## Features

- **Infinite Canvas**: Powered by `Konva.js` for smooth, high-performance rendering.
- **Real-time Collaboration**: WebSocket-based synchronization with proximity-aware updates.
- **AI Team Member**: Integrated with OpenRouter for intelligent drafting, cleanup, and assistance.
- **Invitation-Only Access**: Secure onboarding with SMTP2Go integration.
- **Persistent Sessions**: Board states saved to PostgreSQL.

## Technology Stack

- **Frontend**: React (Vite), Zustand, SCSS, Konva.js.
- **Backend**: Python (FastAPI), WebSockets, OAuth2/JWT.
- **Infrastructure**: PostgreSQL, Redis, Docker.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- API Keys for OpenRouter, SMTP2Go, etc. (see `.env.example`)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/chalkboard.git
   cd chalkboard
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys
   ```

3. Start the application using Docker Compose:
   ```bash
   docker-compose up --build
   ```

The frontend will be available at `http://localhost:5173` (or the port specified in your config).

## Project Structure

- `/frontend`: React client application.
- `/backend`: FastAPI server and WebSocket logic.
- `/docker-compose.yml`: Container orchestration for local development.
