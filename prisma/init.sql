-- Runs once when the Docker postgres container first starts (docker-entrypoint-initdb.d)
-- Enables PostGIS and uuid-ossp so Prisma migrations can use them
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
