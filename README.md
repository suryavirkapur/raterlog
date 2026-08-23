# Raterlog

Raterlog is a real-time monitoring solution for modern product teams. It allows you to track events, monitor potential issues, and make data-driven decisions based on live logs and analytics.

## Go Rewrite

The Go-based rewrite lives at [suryavirkapur/raterlog-go](https://github.com/suryavirkapur/raterlog-go). This repository is the original Rust API and Next.js implementation.

## Demo 



https://github.com/user-attachments/assets/ad45761d-50c6-4296-bf7d-764c7b45bfe6



## Project Structure

The project consists of two main parts:

1. A Rust backend API
2. A Next.js frontend application

### Backend (Rust)

The backend is built with Actix-web and uses Scylla (Cassandra) for storing logs and PostgreSQL for user and company data.

### Frontend (TanStack Start)

The frontend is a [TanStack Start](https://tanstack.com/start) application (TanStack Router + Vite + React), using Radix UI Themes for the interface. It talks to PostgreSQL directly with [postgres.js](https://github.com/porsager/postgres) (no ORM) and uses Lucia for authentication.

## Getting Started

### Run everything with one Docker image

The entire stack (PostgreSQL, Cassandra, MailHog, the Rust API and the web app)
boots from a single top-level `Dockerfile`:

```sh
docker compose up --build
# or, equivalently:
docker build -t raterlog .
docker run -p 3000:3000 -p 8080:8080 -p 8025:8025 raterlog
```

Then open http://localhost:3000 (web), with the API on `:8080` and the MailHog
inbox on `:8025`.

### Local development prerequisites

- Rust (1.85+; the API depends on crates requiring `edition2024`)
- Node.js 22+ and [Bun](https://bun.sh)
- PostgreSQL
- Cassandra (or ScyllaDB)

### Backend Setup

1. Navigate to the `api` directory
2. Install dependencies:

   ```sh
   cargo build
   ```

3. Set up your environment variables (database connections, etc.)
4. Run the migrations:

   ```sh
   cargo run --bin migrate
   ```

5. Start the server:

   ```sh
   cargo run
   ```

### Frontend Setup

1. Navigate to the `web` directory
2. Install dependencies:

   ```sh
   bun install
   ```

3. Set up your environment variables
4. Apply the database schema (`web/schema.sql`):

   ```sh
   bun run db
   ```

5. Start the development server:

   ```sh
   bun run dev
   ```

## Features

- Real-time log monitoring
- User authentication and authorization
- Company and channel management
- Token-based API access
- Live charts and analytics

## Database Schema

The project uses both ScyllaDB/Cassandra (for logs) and PostgreSQL (for user and company data). The PostgreSQL schema is defined in `web/schema.sql`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
