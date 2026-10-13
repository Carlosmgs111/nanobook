import { createDatabase } from "./createDatabase";
import { getDatabaseOptions } from "./databaseConfig";

export const { client, db } = createDatabase(getDatabaseOptions());
