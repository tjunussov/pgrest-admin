# PgRestAdmin - Development Notes

## Docker Workflow

- **Never restart the container** for code changes — HMR picks up all changes from `./app/src/` instantly via volume mount.
- Only restart (`docker restart pgrestadmin`) if you change `quasar.config.js` or `.env`.
- To install new npm packages, run inside the container:
  ```
  docker exec pgrestadmin npm install <package-name>
  ```
- Container uses `node:20-alpine` directly (no Dockerfile), with `npm install && quasar dev` as command.

## Tech Stack

- Quasar 2 (Vue 3, Vite) with Pug templates
- Pinia for state management
- Axios for HTTP
- Dark theme, Material Icons
- Vitest for tests

## Project Structure

```
app/
├── quasar.config.js        # Quasar/Vite config (restart needed on change)
├── src/
│   ├── boot/axios.js       # Axios instance + error interceptor
│   ├── stores/connection.js # Multi-connection manager (localStorage)
│   ├── stores/schema.js    # Schema/table metadata cache + exec_sql
│   ├── layouts/MainLayout.vue
│   ├── pages/IndexPage.vue
│   └── components/
│       ├── ConnectionDialog.vue  # Login form + URL dropdown + exec_sql snippet
│       ├── ResourceTree.vue      # QTree with lazy-loaded schema browser
│       ├── DataGrid.vue          # QTable with PostgREST pagination/sort/filter
│       ├── StructureTab.vue      # Columns, indexes, triggers, constraints
│       ├── SqlLab.vue            # SQL editor via rpc/exec_sql
│       ├── FilterBar.vue         # PostgREST filter builder
│       ├── CrudDialog.vue        # Insert/edit rows
│       └── AppFooter.vue         # Version from package.json
└── test/
    ├── api.test.js              # Integration tests against PostgREST
    └── stores/connection.test.js # Store unit tests
```

## Running Tests

```
cd app && npx vitest run
```

## Key Conventions

- All Vue templates use `lang="pug"`
- All `.vue` files must have closing `</template>` and `</script>` tags
- Dark theme — do not add light theme styles
- No icons inside form inputs (clean minimal look)
- Connection URLs saved in localStorage, selectable via dropdown
