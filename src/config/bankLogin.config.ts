import { registerAs } from '@nestjs/config';
export default registerAs('bankLogin', () => ({
  account: process.env.ACCOUNT,
  password: process.env.PASSWORD,
  certPath: process.env.CERTIFICARE_PATH,
  certPassword: process.env.CERTIFICARE_PASSWORD,
}));
