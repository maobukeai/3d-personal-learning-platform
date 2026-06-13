import { normalizeWebhookUrl, type WebhookDnsLookup } from '../src/utils/webhook-url';

const publicLookup: WebhookDnsLookup = async () => [{ address: '8.8.8.8', family: 4 }];
const privateLookup: WebhookDnsLookup = async () => [{ address: '10.0.0.8', family: 4 }];

describe('normalizeWebhookUrl', () => {
  it('accepts an HTTPS URL whose hostname resolves to a public address', async () => {
    await expect(
      normalizeWebhookUrl('https://hooks.example.com/robot?token=abc', { lookup: publicLookup }),
    ).resolves.toBe('https://hooks.example.com/robot?token=abc');
  });

  it('rejects public HTTP webhook URLs outside local development loopback', async () => {
    await expect(
      normalizeWebhookUrl('http://hooks.example.com/robot', { lookup: publicLookup }),
    ).rejects.toMatchObject({ code: 'AI_BOT_WEBHOOK_HTTPS_REQUIRED' });
  });

  it('allows local loopback HTTP webhook URLs outside production for development testing', async () => {
    await expect(normalizeWebhookUrl('http://127.0.0.1:3999/robot')).resolves.toBe(
      'http://127.0.0.1:3999/robot',
    );
  });

  it('rejects hostnames that resolve to private or reserved addresses', async () => {
    await expect(
      normalizeWebhookUrl('https://hooks.example.com/robot', { lookup: privateLookup }),
    ).rejects.toMatchObject({ code: 'AI_BOT_WEBHOOK_PRIVATE_HOST' });
  });

  it('rejects unresolvable hostnames', async () => {
    const failingLookup: WebhookDnsLookup = async () => {
      throw new Error('ENOTFOUND');
    };

    await expect(
      normalizeWebhookUrl('https://missing.example.com/robot', { lookup: failingLookup }),
    ).rejects.toMatchObject({ code: 'AI_BOT_WEBHOOK_HOST_UNRESOLVABLE' });
  });
});
