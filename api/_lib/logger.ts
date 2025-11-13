import pino from "pino";
import { ENV } from "./env";

export const log = pino({ level: ENV.LOG_LEVEL });


