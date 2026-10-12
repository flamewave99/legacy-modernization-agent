-- Mirrors legacy/src/main/resources/db/postgresql/schema.sql (SPEC §7.1).
-- Drops everything first so `npm run db:reset` starts from a clean slate.
DROP TABLE IF EXISTS visits, pets, owners, types, vet_specialties, specialties, vets CASCADE;

CREATE TABLE vets (
  id SERIAL,
  first_name VARCHAR(30),
  last_name VARCHAR(30),
  CONSTRAINT pk_vets PRIMARY KEY (id)
);
CREATE INDEX idx_vets_last_name ON vets (last_name);

CREATE TABLE specialties (
  id SERIAL,
  name VARCHAR(80),
  CONSTRAINT pk_specialties PRIMARY KEY (id)
);
CREATE INDEX idx_specialties_name ON specialties (name);

CREATE TABLE vet_specialties (
  vet_id INT NOT NULL,
  specialty_id INT NOT NULL,
  FOREIGN KEY (vet_id) REFERENCES vets(id),
  FOREIGN KEY (specialty_id) REFERENCES specialties(id),
  CONSTRAINT unique_ids UNIQUE (vet_id, specialty_id)
);

CREATE TABLE types (
  id SERIAL,
  name VARCHAR(80),
  CONSTRAINT pk_types PRIMARY KEY (id)
);
CREATE INDEX idx_types_name ON types (name);

CREATE TABLE owners (
  id SERIAL,
  first_name VARCHAR(30),
  last_name VARCHAR(30),
  address VARCHAR(255),
  city VARCHAR(80),
  telephone VARCHAR(20),
  CONSTRAINT pk_owners PRIMARY KEY (id)
);
CREATE INDEX idx_owners_last_name ON owners (last_name);

CREATE TABLE pets (
  id SERIAL,
  name VARCHAR(30),
  birth_date DATE,
  type_id INT NOT NULL,
  owner_id INT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id),
  FOREIGN KEY (type_id) REFERENCES types(id),
  CONSTRAINT pk_pets PRIMARY KEY (id)
);
CREATE INDEX idx_pets_name ON pets (name);

CREATE TABLE visits (
  id SERIAL,
  pet_id INT NOT NULL,
  visit_date DATE,
  description VARCHAR(255),
  FOREIGN KEY (pet_id) REFERENCES pets(id),
  CONSTRAINT pk_visits PRIMARY KEY (id)
);
CREATE INDEX idx_visits_pet_id ON visits (pet_id);
