"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ env }) => ({
    connection: {
        client: "postgres",
        connection: {
            host: env("DATABASE_HOST", "strapi-database.cb9lzky8cf8g.us-east-1.rds.amazonaws.com"),
            port: env.int("DATABASE_PORT", 5432),
            database: env("DATABASE_NAME", "strapi-database"),
            user: env("DATABASE_USERNAME", "postgres"),
            password: env("DATABASE_PASSWORD", "ltrek12345"),
            ssl: env.bool("DATABASE_SSL", true),
        },
    },
});
