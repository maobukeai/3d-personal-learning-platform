import nodemailer from 'nodemailer';
import dns from 'dns';
import prisma from '../services/prisma';

function resolveRealIp(hostname: string): Promise<string> {
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    resolver.setServers(['119.29.29.29', '223.5.5.5', '8.8.8.8']);
    resolver.resolve4(hostname, (err, addresses) => {
      if (!err && addresses && addresses.length > 0) {
        resolve(addresses[0]);
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
