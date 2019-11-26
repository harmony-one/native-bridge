import development from "./development.config";
import production from "./production.config";
import example from "./example.config";

require('dotenv').config();

const env = process.env.APP_ENV || 'development';

const config = {
  example: example,
  development: development,
  production: production
};

export default config[env];
