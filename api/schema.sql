-- MySQL / MariaDB schema. Run once: mysql -u <user> -p < api/schema.sql

CREATE DATABASE IF NOT EXISTS register_login CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE register_login;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(32)  NOT NULL UNIQUE,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  login_count   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
