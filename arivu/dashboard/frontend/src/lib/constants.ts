export const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg",
  mysql: "/mysql-logo.svg",
  sqlite: "/sqlite-logo.svg",
  snowflake: "/snowflake-ar21.svg",
  databricks: "/azure-databricks.svg",
};

export const DIALECT_LABELS: Record<string, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  snowflake: "Snowflake",
  databricks: "Databricks",
};

export const DIALECT_COLORS: Record<string, string> = {
  postgresql: "#336791",
  mysql: "#4479A1",
  sqlite: "#003B57",
  snowflake: "#29B5E8",
  databricks: "#FF3621",
};

export const CLOUD_DIALECTS = ["snowflake", "databricks"];

export function isCloudDialect(dialect: string): boolean {
  return CLOUD_DIALECTS.includes(dialect);
}

export function getDialectLogo(dialect: string): string {
  return DIALECT_LOGOS[dialect] || DIALECT_LOGOS.postgresql;
}

export function getDialectLabel(dialect: string): string {
  return DIALECT_LABELS[dialect] || dialect;
}
