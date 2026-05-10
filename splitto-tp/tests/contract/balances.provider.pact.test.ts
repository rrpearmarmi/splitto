import path from 'path';
import fs from 'fs/promises';
import http from 'http';
import { Verifier } from '@pact-foundation/pact';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Pool } from 'pg';
import { describe, it, beforeAll, afterAll } from 'vitest';

// ✅ createApp prend un Pool directement (pas { pool })
import { createApp } from '../../src/server';

let pgContainer: StartedTestContainer;
let pool: Pool;
let server: http.Server;
let serverPort: number;

beforeAll(async () => {
  // 1. Lancer Postgres via Testcontainers
  pgContainer = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'splitto_test',
    })
    .withExposedPorts(5432)
    .start();

  pool = new Pool({
    host: pgContainer.getHost(),
    port: pgContainer.getMappedPort(5432),
    user: 'test',
    password: 'test',
    database: 'splitto_test',
  });

  // 2. Migrations (nom du fichier vu dans le screenshot : 001-initial.sql)
  const migrationSQL = await fs.readFile(
    path.resolve(__dirname, '../../migrations/001-initial.sql'),
    'utf-8'
  );
  await pool.query(migrationSQL);

  // 3. Créer l'app — ✅ createApp(pool) et non createApp({ pool })
  const app = createApp(pool);

  // 4. Ajouter l'endpoint Pact pour les state handlers
  //    Pact envoie POST /_pact/provider-states { state: '...' }
  app.post('/_pact/provider-states', async (req, res) => {
    const { state } = req.body as { state: string };

    const handlers: Record<string, () => Promise<void>> = {

      'group-1 a 3 membres et 2 dépenses': async () => {
        // ✅ server.ts utilise TRUNCATE groups CASCADE
        // qui supprime aussi members + expenses par cascade
        await pool.query('TRUNCATE groups CASCADE');

        await pool.query(
          'INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)',
          ['group-1', 'Vacances', 'EUR']
        );

        // server.ts insère les membres avec (id, group_id, name, email)
        await pool.query(`
          INSERT INTO members (id, group_id, name, email) VALUES
            ('member-1', 'group-1', 'Alice', 'alice@test.com'),
            ('member-2', 'group-1', 'Bob',   'bob@test.com'),
            ('member-3', 'group-1', 'Charlie','charlie@test.com')
        `);

        // server.ts insère les expenses avec split_mode + split_data
        // Alice paie 30€ pour tout le monde (equal)
        await pool.query(`
          INSERT INTO expenses
            (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data)
          VALUES (
            'expense-1', 'group-1', 'Restaurant', 30, 'EUR', 'member-1',
            NOW(),
            'equal',
            '{"mode":"equal","beneficiaries":["member-1","member-2","member-3"]}'
          )
        `);

        // Bob paie 20€ pour tout le monde (equal)
        await pool.query(`
          INSERT INTO expenses
            (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data)
          VALUES (
            'expense-2', 'group-1', 'Courses', 20, 'EUR', 'member-2',
            NOW(),
            'equal',
            '{"mode":"equal","beneficiaries":["member-1","member-2","member-3"]}'
          )
        `);
      },

      'aucun groupe inexistant': async () => {
        // ✅ Même pattern que /_test/reset dans server.ts
        await pool.query('TRUNCATE groups CASCADE');
      },
    };

    const handler = handlers[state];
    if (handler) {
      await handler();
      res.json({ state, success: true });
    } else {
      res.status(404).json({ error: `State handler inconnu: "${state}"` });
    }
  });

  // 5. Démarrer le serveur sur un port aléatoire (0 = OS choisit)
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  serverPort = (server.address() as any).port;

}, 60_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  await pgContainer.stop();
});

describe('Provider contract — splitto-api', () => {
  it('honore le contrat généré par splitto-frontend', async () => {
    const verifier = new Verifier({
      provider: 'splitto-api',
      providerBaseUrl: `http://localhost:${serverPort}`,

      pactUrls: [
        path.resolve(__dirname, '../../pacts/splitto-frontend-splitto-api.json'),
      ],

      providerStatesSetupUrl: `http://localhost:${serverPort}/_pact/provider-states`,

      logLevel: 'warn',
    });

    await verifier.verifyProvider();
  }, 60_000);
});