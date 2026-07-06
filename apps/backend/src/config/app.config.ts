import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const appConfigSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('http://localhost:8081'),

  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),

  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_ACCESS_TTL: Joi.number().default(900),
  JWT_REFRESH_TTL: Joi.number().default(604800),

  SMS_PROVIDER: Joi.string().valid('console', 'msg91', 'twilio').default('console'),
  MSG91_AUTH_KEY: Joi.string().when('SMS_PROVIDER', { is: 'msg91', then: Joi.required() }),
  MSG91_SENDER_ID: Joi.string().when('SMS_PROVIDER', { is: 'msg91', then: Joi.required() }),
  MSG91_TEMPLATE_ID: Joi.string().when('SMS_PROVIDER', { is: 'msg91', then: Joi.required() }),
  TWILIO_ACCOUNT_SID: Joi.string().when('SMS_PROVIDER', { is: 'twilio', then: Joi.required() }),
  TWILIO_AUTH_TOKEN: Joi.string().when('SMS_PROVIDER', { is: 'twilio', then: Joi.required() }),
  TWILIO_FROM_NUMBER: Joi.string().when('SMS_PROVIDER', { is: 'twilio', then: Joi.required() }),

  NOMINATIM_BASE_URL: Joi.string().default('https://nominatim.openstreetmap.org'),

  ADMIN_ALLOWED_IPS: Joi.string().default('127.0.0.1'),

  RATE_LIMIT_SEND_OTP_PER_HOUR: Joi.number().default(5),
  RATE_LIMIT_VERIFY_OTP_PER_5MIN: Joi.number().default(3),
  RATE_LIMIT_CREATE_REQUEST_PER_HOUR: Joi.number().default(10),
  RATE_LIMIT_REPORT_PER_DAY: Joi.number().default(5),
  RATE_LIMIT_DEFAULT_PER_MIN: Joi.number().default(100),
});

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV,
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN,
  adminAllowedIps: (process.env.ADMIN_ALLOWED_IPS ?? '127.0.0.1').split(',').map(ip => ip.trim()),
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL,
  rateLimit: {
    sendOtpPerHour: parseInt(process.env.RATE_LIMIT_SEND_OTP_PER_HOUR ?? '5', 10),
    verifyOtpPer5Min: parseInt(process.env.RATE_LIMIT_VERIFY_OTP_PER_5MIN ?? '3', 10),
    createRequestPerHour: parseInt(process.env.RATE_LIMIT_CREATE_REQUEST_PER_HOUR ?? '10', 10),
    reportPerDay: parseInt(process.env.RATE_LIMIT_REPORT_PER_DAY ?? '5', 10),
    defaultPerMin: parseInt(process.env.RATE_LIMIT_DEFAULT_PER_MIN ?? '100', 10),
  },
}));
