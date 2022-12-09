export default ({ env }) => ({
  host: env("HOST"),
  port: env.int("PORT", 1337),
  // url: 'http://35.171.1.40:1337/',
  app: {
    keys: env.array("APP_KEYS"),
  },
});

// , '10.0.0.1'
