-- Create databases and users for all services

-- Kratos database
CREATE USER kratos WITH PASSWORD 'secret';
CREATE DATABASE kratos;
GRANT ALL PRIVILEGES ON DATABASE kratos TO kratos;

-- Permiso database
CREATE USER permiso WITH PASSWORD 'permiso';
CREATE DATABASE permiso;
GRANT ALL PRIVILEGES ON DATABASE permiso TO permiso;

-- Shaman database
CREATE USER shaman WITH PASSWORD 'shaman';
CREATE DATABASE shaman;
GRANT ALL PRIVILEGES ON DATABASE shaman TO shaman;

-- Foreman database
CREATE USER foreman WITH PASSWORD 'foreman';
CREATE DATABASE foreman;
GRANT ALL PRIVILEGES ON DATABASE foreman TO foreman;

-- Grant schema permissions (PostgreSQL 15+)
\c kratos
GRANT ALL ON SCHEMA public TO kratos;

\c permiso
GRANT ALL ON SCHEMA public TO permiso;

\c shaman
GRANT ALL ON SCHEMA public TO shaman;

\c foreman
GRANT ALL ON SCHEMA public TO foreman;