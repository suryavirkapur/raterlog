# Raterlog

Raterlog is a real-time monitoring solution for modern product teams. It allows you to track events, monitor potential issues, and make data-driven decisions based on live logs and analytics.

## Project Structure

The project consists of two main parts:

1. A Rust backend API
2. A Next.js frontend application

### Backend (Rust)

The backend is built with Actix-web and uses Scylla (Cassandra) for storing logs and PostgreSQL for user and company data.

### Frontend (Next.js)

The frontend is a Next.js application using React and Radix UI for the interface.

## Getting Started

### Prerequisites

- Rust
- Node.js
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
4. Run the database migrations:

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

The project uses both ScyllaDB (for logs) and PostgreSQL (for user and company data). The PostgreSQL schema can be found in:

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
