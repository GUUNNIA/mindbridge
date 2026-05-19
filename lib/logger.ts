import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
    },
  }),
  base: { service: "mindbridge" },
  redact: {
    paths: [
      "*.password",
      "*.passwordHash",
      "*.realName",
      "*.phone",
      "*.soapNote",
      "*.transcript",
      "*.email",
    ],
    censor: "[REDACTED]",
  },
});
