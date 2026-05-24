import nodemailer from 'nodemailer';
import dns from 'dns';
import prisma from '../services/prisma';
import { MicrosoftGraphService } from '../services/microsoftGraph.service';

function resolveRealIp(hostname: string): Promise<string> {
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    resolver.setServers(['119.29.29.29', '223.5.5.5', '8.8.8.8']);
    resolver.resolve4(hostname, (err, addresses) => {
      if (!err && addresses && addresses.length > 0) {
        resolve(addresses[0]!);
      } else {
        resolve(hostname);
      }
    });
  });
}

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedConfigHash: string = '';

function buildConfigHash(config: Record<string, string>): string {
  return `${config.SMTP_HOST}|${config.SMTP_PORT}|${config.SMTP_USER}|${config.SMTP_PASS}|${config.SMTP_SECURE}`;
}

async function getTransporter(): Promise<{
  transporter: nodemailer.Transporter | null;
  config: Record<string, string>;
}> {
  const settings = await prisma.systemSetting.findMany();
  const config = settings.reduce(
    (acc: any, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    },
    {} as Record<string, string>,
  );

  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    if (cachedTransporter) {
      cachedTransporter.close();
      cachedTransporter = null;
      cachedConfigHash = '';
    }
    return { transporter: null, config };
  }

  const hash = buildConfigHash(config);
  if (cachedTransporter && cachedConfigHash === hash) {
    return { transporter: cachedTransporter, config };
  }

  if (cachedTransporter) {
    cachedTransporter.close();
  }

  const isSecure = config.SMTP_SECURE === 'true';
  const port = parseInt(config.SMTP_PORT) || (isSecure ? 465 : 587);

  const realIp = await resolveRealIp(config.SMTP_HOST);

  cachedTransporter = nodemailer.createTransport({
    host: realIp,
    port,
    secure: isSecure,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
      servername: config.SMTP_HOST,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });

  cachedConfigHash = hash;
  return { transporter: cachedTransporter, config };
}

export const sendEmail = async (to: string, subject: string, text: string, html: string) => {
  const { transporter, config } = await getTransporter();

  const provider = config.SYSTEM_EMAIL_PROVIDER || 'SMTP';
  const fallbackSmtp = config.MICROSOFT_POOL_FAILBACK !== 'false';

  if (provider === 'MICROSOFT_POOL') {
    console.log(
      `[Email Pool] Attempting to send system email to "${to}" via Microsoft account pool...`,
    );
    try {
      const activeAccounts = await prisma.microsoftEmailAccount.findMany({
        where: {
          status: 'ACTIVE',
          user: {
            role: 'ADMIN',
          },
        },
      });

      const eligibleAccounts = activeAccounts.filter((acc) => acc.sentCountToday < acc.dailyLimit);

      if (eligibleAccounts.length > 0) {
        // Round-Robin: select the one with the lowest sent count today
        eligibleAccounts.sort((a, b) => a.sentCountToday - b.sentCountToday);
        const selectedAccount = eligibleAccounts[0]!;

        console.log(
          `[Email Pool] Selected account: ${selectedAccount.email} (Sent today: ${selectedAccount.sentCountToday}/${selectedAccount.dailyLimit})`,
        );

        await MicrosoftGraphService.sendMail(selectedAccount.id, {
          to,
          subject,
          content: html || text,
        });

        console.log(
          `[Email Pool Success] System email successfully sent from ${selectedAccount.email} to ${to}`,
        );
        return true;
      } else {
        console.warn(
          '[Email Pool] No eligible Microsoft accounts in pool (either none active or all hit daily limits).',
        );
        if (!fallbackSmtp) {
          console.error(
            '[Email Pool Error] No eligible accounts in pool, and SMTP fallback is disabled.',
          );
          return false;
        }
        console.log('[Email Pool Fallback] Falling back to standard SMTP sending...');
      }
    } catch (err: any) {
      console.error(`[Email Pool Error] Failed to send via Microsoft Pool:`, err.message);
      if (!fallbackSmtp) {
        return false;
      }
      console.log(
        '[Email Pool Fallback] Falling back to standard SMTP sending due to pool failure...',
      );
    }
  }

  if (!transporter) {
    console.log(`[Email Mock/Not Configured] To: ${to}, Subject: ${subject}`);
    return true;
  }

  const fromEmail = config.SMTP_FROM || config.SMTP_USER;
  const from = config.SMTP_FROM_NAME ? `"${config.SMTP_FROM_NAME}" <${fromEmail}>` : fromEmail;

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    console.log(`[Email Success] To: ${to}`);
    return true;
  } catch (error) {
    console.error(`[Email Error] To: ${to}`, error);
    cachedTransporter = null;
    cachedConfigHash = '';
    return false;
  }
};
