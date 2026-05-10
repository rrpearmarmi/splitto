import path from 'path';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { describe, it, expect } from 'vitest';

const { like, regex, decimal } = MatchersV3;

const provider = new PactV3({
  consumer: 'splitto-frontend',
  provider: 'splitto-api',
  dir: path.resolve(__dirname, '../../pacts'),
  port: 4000,
  logLevel: 'warn',
});

async function fetchBalances(groupId: string) {
  const res = await fetch(`http://localhost:4000/api/groups/${groupId}/balances`);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as any;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

describe('Consumer contract — GET /api/groups/:id/balances', () => {

  it('retourne 200 avec les soldes quand le groupe a des dépenses', async () => {
    await provider
      .given('group-1 a 3 membres et 2 dépenses')
      .uponReceiving('une requête pour les soldes du groupe group-1')
      .withRequest({
        method: 'GET',
        path: '/api/groups/group-1/balances',
        headers: { Accept: like('application/json') },
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': regex('application\\/json.*', 'application/json'),
        },
        body: {
          groupId: like('group-1'),
          balances: like({
            'member-1': decimal(20.0),
            'member-2': decimal(-10.0),
            'member-3': decimal(-10.0),
          }),
          // settlements est aussi retourné par le serveur (voir server.ts ligne balances)
          settlements: like([]),
        },
      })
      .executeTest(async () => {
        const result = await fetchBalances('group-1');

        expect(result).toHaveProperty('balances');
        expect(result).toHaveProperty('settlements');
        expect(result).toHaveProperty('groupId');
        expect(typeof result.balances).toBe('object');

        for (const balance of Object.values(result.balances)) {
          expect(typeof balance).toBe('number');
        }
      });
  });

  it("retourne 404 quand le groupe n'existe pas", async () => {
    await provider
      .given('aucun groupe inexistant')
      .uponReceiving("une requête pour les soldes d'un groupe inexistant")
      .withRequest({
        method: 'GET',
        path: '/api/groups/inexistant/balances',
      })
      .willRespondWith({
        status: 404,
        headers: {
          'Content-Type': regex('application\\/json.*', 'application/json'),
        },
        body: {
          error: like('Group not found'),
        },
      })
      .executeTest(async () => {
        await expect(fetchBalances('inexistant')).rejects.toMatchObject({
          status: 404,
        });
      });
  });
});