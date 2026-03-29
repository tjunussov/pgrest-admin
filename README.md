# PgRestAdmin

A lightweight web-based administration tool for PostgreSQL databases exposed via [PostgREST](https://postgrest.org). A "pgAdmin-lite" experience for browsing schemas, inspecting metadata, and performing CRUD operations.

**Online Demo:** [https://pgadmin.imbir.kz](https://pgadmin.imbir.kz)

## Features

- **Resource Explorer** — hierarchical tree of schemas, tables, views, columns, indexes, triggers, constraints, and functions with lazy loading
- **Data Browser** — sortable, filterable data grid with server-side pagination via PostgREST Range headers
- **CRUD Operations** — insert, edit, and delete rows with automatic primary key detection
- **Structure Inspector** — detailed view of columns, indexes, triggers, and constraints for any table
- **SQL Lab** — raw SQL editor with results grid, powered by a `exec_sql` database function
- **Multi-Connection** — save and switch between multiple PostgREST endpoints (stored in localStorage)
- **Dark Theme** — clean, dark UI built with Quasar Framework

## Quick Start

```bash
docker compose up -d
```

The app will be available on port 9000 inside the Docker network. If you have nginx configured, point it to `pgrestadmin:9000`.

### Prerequisites

- Docker with an external `nginx` network
- A running PostgREST instance to connect to

### Database Setup

To enable metadata browsing and SQL Lab, run this function on your target database:

```sql
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
  RETURNS json AS $$
DECLARE
    result json;
BEGIN
    EXECUTE 'SELECT json_agg(t) FROM (' || query || ') t' INTO result;
    RETURN coalesce(result, '[]'::json);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'error', SQLERRM,
        'detail', SQLSTATE,
        'hint', 'Ensure the query is a valid SELECT or returns a result set.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

This snippet is also available in the connection dialog under "Setup: exec_sql function".

## Configuration

Environment variables in `.env`:

| Variable | Description | Default |
|---|---|---|
| `VITE_DEFAULT_API_URL` | Default PostgREST URL pre-filled in login | `https://pos.imbir.kz/api` |
| `VITE_DEFAULT_API_NAME` | Display name for the default connection | `SmartPOS` |

## Development

Code changes are picked up instantly via HMR — no container restart needed.

```bash
# Install a new package
docker exec pgrestadmin npm install <package-name>

# Run tests
cd app && npx vitest run

# View logs
docker logs pgrestadmin -f
```

Only restart the container if `quasar.config.js` or `.env` changes.

## Tech Stack

- [Quasar Framework](https://quasar.dev) (Vue 3, Vite)
- [Pug](https://pugjs.org/) templates
- [Pinia](https://pinia.vuejs.org/) state management
- [Axios](https://axios-http.com/) HTTP client
- [Vitest](https://vitest.dev/) testing
