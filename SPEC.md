# PetClinic behavior spec

Derived from the legacy code in `legacy/` (Spring Framework 7 PetClinic, upstream commit
`cf392920cdbe9cd07689f1f4b603271940bac957`). Four subagents analyzed it in parallel (routes,
domain/schema, views, validation), and their findings were checked against the running app.

**Source of truth.** When this document and `tests/characterization/` disagree, the tests win:
they were run against legacy. Evidence tags:

- **[test]** pinned by a characterization test
- **[obs]** observed on the running app (curl/browser)
- **[code]** read in code, not exercised

Paths like `OwnerController.java:60` are under
`legacy/src/main/java/org/springframework/samples/petclinic/`. JSPs are under
`legacy/src/main/webapp/WEB-INF/`.

---

## 1. Target architecture (modern)

| Concern | Legacy | Modern |
|---|---|---|
| UI | JSP server-rendered, Bootstrap CSS, flatpickr | React + Vite + TypeScript (`modern/web`), React Router |
| Server | Spring MVC on Tomcat 11 | Node + Fastify + TypeScript (`modern/api`) |
| DB | H2 in-memory, re-seeded on start | Postgres 17 (docker compose service `db`, host port **5433**; 5432 is taken locally) |
| Origin | `http://localhost:8080` | One origin, `http://localhost:3000`: Fastify serves the JSON API under `/api/*`, the legacy-compatible `/vets.json` and `/vets.xml`, static assets, and the built SPA for page routes |

**Why one origin, not the Vite dev server.** Some page URLs must return non-200 statuses:
404 for unknown paths and 400 for non-numeric ids [test]. A Vite dev server answers every path
with `index.html` and 200. So the characterization suite runs against Fastify serving the built
web app: `BASE_URL=http://localhost:3000`. Vite's dev server (5173, proxying `/api` to Fastify)
is only for development.

**Page-route status rules** (enforced by Fastify before serving `index.html`):
- Known page patterns (§3) return 200.
- A known pattern with a non-numeric `{ownerId}`/`{petId}` returns 400.
- Anything else returns 404.
- Data-level misses (unknown owner id) still return 200 and render the friendly error page client-side, matching legacy [test].

---

## 2. Global page chrome [test][obs]

- `<title>` on every page is exactly `PetClinic :: a Spring Framework demonstration` [test].
- **Navbar** (`role=navigation`). The links, in order:

  | Text | Target |
  |---|---|
  | Home | `/` |
  | Find owners | `/owners/find` |
  | Veterinarians | `/vets` |
  | Error | `/oups` |

  - The brand logo also links to `/` [test for the four links].
  - The active item reflects the page group: home, owners (all owner/pet/visit pages), vets, error [code].
- **Bottom of every page:** image `/resources/images/spring-pivotal-logo.png` with alt "Sponsored by Pivotal" [obs].
- **Static assets.** Copy them from `legacy/src/main/webapp/resources/` to keep the look:
  - `petclinic.css` (bundles Bootstrap 5.1.3 and the theme)
  - fonts
  - images: `pets.png`, `favicon.png`, logos

  Font Awesome 4.7 icons are used in nav [obs]. Keep `/resources/...` URLs working (nice to have, not tested).
- **Language:** English only in the modern app. Legacy localizes a few messages by Accept-Language (de/es, with a mojibake bug in German); the suite pins `en-US`. Decision: do not port i18n (NOTES.md).

---

## 3. Routes

| Method | Path | Behavior | Evidence |
|---|---|---|---|
| GET | `/` | Welcome page: h2 "Welcome", image alt "A cat and a dog" (`/resources/images/pets.png`) | [test] |
| GET | `/owners/find` | Find Owners form | [test] |
| GET | `/owners?lastName=` | Search (§5.1). No param = all owners | [test] |
| GET | `/owners/new` | New owner form | [test] |
| POST | `/owners/new` | Create owner → redirect `/owners/{newId}`; errors re-show form (URL stays `/owners/new`) | [test] |
| GET | `/owners/{ownerId}` | Owner details | [test] |
| GET | `/owners/{ownerId}/edit` | Edit owner form | [test] |
| POST | `/owners/{ownerId}/edit` | Update → redirect `/owners/{ownerId}` | [test] |
| GET | `/owners/{ownerId}/pets/new` | New pet form | [test] |
| POST | `/owners/{ownerId}/pets/new` | Create pet → redirect `/owners/{ownerId}` | [test] |
| GET | `/owners/{ownerId}/pets/{petId}/edit` | Edit pet form | [test] |
| POST | `/owners/{ownerId}/pets/{petId}/edit` | Update pet → redirect `/owners/{ownerId}` | [test] |
| GET | `/owners/{ownerId}/pets/{petId}/visits/new` | New visit form (legacy ignores `ownerId` here) | [test] |
| POST | `/owners/{ownerId}/pets/{petId}/visits/new` | Create visit → redirect `/owners/{ownerId}` | [test] |
| GET | `/owners/{ownerId}/pets/{petId}/visits` | Legacy: always 404 (missing view `visitList.jsp`) | [test @legacy-bug] |
| GET | `/vets` | Vets page | [test] |
| GET | `/vets.json` | JSON, exact body (§7) | [test] |
| GET | `/vets.xml` | XML, exact body (§7) | [test] |
| GET | `/oups` | Friendly error page, HTTP 200, message `Expected: controller used to showcase what happens when an exception is thrown` | [test] |
| GET | unknown path | 404 | [test] |
| GET | `/owners/abc` (non-numeric id) | 400 | [test] |
| GET | `/owners/999999` (unknown id) | **200** friendly error page "Something happened..." | [test] |

In the SPA, the "POST" rows are form submissions handled by the React app calling the JSON API.
The observable contract is the URL after submit and what is rendered.

**Legacy route details not pinned by tests** [obs], for reference:
- No trailing-slash matching: `/owners/1/` gives 404.
- `/vets.json` and `/vets.xml` return 406 when the Accept header excludes their type.
- Exceptions on the friendly page are served as ISO-8859-1.
- Unknown pet ids:
  - `/owners/1/pets/999999/visits/new` returns 200 with the friendly error.
  - `/owners/1/pets/999999/edit` returns a raw Tomcat **500** [test @legacy-bug].

---

## 4. Pages

### 4.1 Find Owners (`/owners/find`) [test]
- h2 "Find Owners".
- Text input `name="lastName"` (maxlength 80).
- Button "Find Owner". The form is a GET to `/owners`, so the URL becomes `/owners?lastName=<term>`.
- Link "Add Owner" goes to `/owners/new`.
- On no match:
  - The page stays on `/owners?lastName=<term>`.
  - It shows the Find Owners form with the term kept in the input.
  - The message `has not been found` appears in the lastName field's container.

### 4.2 Owners list (2+ results) [test]
- h2 "Owners".
- Table header: `Name | Address | City | Telephone | Pets`.
- One row per owner:
  - The name cell is a link `First Last` to `/owners/{id}`.
  - The pets cell lists pet names sorted case-insensitively, separated by spaces.
- Rows are in owner **id order**. Legacy has no ORDER BY and H2 returns id order; modern uses `ORDER BY id` [test].

### 4.3 Owner details (`/owners/{id}`) [test]
- h2 "Owner Information".
- A table of `th`-labelled rows:
  - `Name`: `First Last`, in bold
  - `Address`
  - `City`
  - `Telephone`
- Links "Edit Owner" (to `/owners/{id}/edit`) and "Add New Pet" (to `/owners/{id}/pets/new`). Legacy uses relative hrefs; only the target matters.
- h2 "Pets and Visits". For each pet, **sorted by name case-insensitively**:
  - **Pet block:** `Name <name> Birth Date <yyyy-MM-dd> Type <type>`.
  - **Visits table:** header `Visit Date | Description`, then visits **sorted by date descending**. Dates are `yyyy-MM-dd`.
  - **Links:** "Edit Pet" to `/owners/{id}/pets/{petId}/edit`, and "Add Visit" to `/owners/{id}/pets/{petId}/visits/new`.
- Collapsed page text must contain the sequences the tests check, e.g.
  `Name Max Birth Date 2012-09-04 Type cat Visit Date Description 2013-01-03 neutered 2013-01-02 rabies shot`.
  Keep the label/value reading order.
- All user data is HTML-escaped [test].

### 4.4 Owner form [test]

| | New (`/owners/new`) | Edit (`/owners/{id}/edit`) |
|---|---|---|
| h2 | "New Owner" | "Owner" |
| Fields | empty | pre-filled |
| Button | "Add Owner" | "Update Owner" |

- Fields in order: `firstName`, `lastName`, `address`, `city`, `telephone`, labelled First Name, Last Name, Address, City, Telephone.
- On validation failure:
  - The form re-renders on the same URL.
  - Entered values are kept.
  - Each invalid field shows one message inside its own container (§6).
- **Legacy quirk** [test @legacy-bug]: a rejected *edit* re-renders as "New Owner" / "Add Owner".

### 4.5 Pet form [test]

| | New (`/owners/{o}/pets/new`) | Edit (`/owners/{o}/pets/{p}/edit`) |
|---|---|---|
| h2 | "New Pet" | "Pet" |
| Button | "Add Pet" | "Update Pet" |

- An "Owner" row shows the owner's `First Last` as text.
- Fields:
  - `name` (text)
  - `birthDate` (text date)
  - `type`: a `<select name="type">`. Options, value = text, in this order: `bird, cat, dog, hamster, lizard, snake`. No placeholder option. Nothing is selected on new.
- **Edit form date display:**
  - The browser shows the birth date as `yyyy-MM-dd` (e.g. `2010-09-07`) [test].
  - Legacy's HTML says `2010/09/07`, but its flatpickr date widget reformats the value on load.
- Submitting the edit form unchanged succeeds [test].

### 4.6 Visit form (`/owners/{o}/pets/{p}/visits/new`) [test]
- h2 "New Visit".
- A "Pet" table with header `Name | Birth Date | Type | Owner` and one row: pet name, birth date as **`yyyy/MM/dd`**, type, owner `First Last`.
- Field `date`: pre-filled with today. The browser shows it as `yyyy-MM-dd` (flatpickr, as in §4.5).
- Field `description`: empty.
- Button "Add Visit".
- "Previous Visits" table with header `Date | Description`:
  - Saved visits only, date descending.
  - Dates are **`yyyy/MM/dd`** here.
- Exact text, e.g.: `Previous Visits Date Description 2013/01/03 neutered 2013/01/02 rabies shot` [test].

### 4.7 Vets (`/vets`) [test]
- h2 "Veterinarians".
- Table header `Name | Specialties`.
- Rows ordered by last name, then first name.
- Specialties are sorted by name and space-separated, or `none`.
- Links "View as XML" (`/vets.xml`) and "View as JSON" (`/vets.json`), as absolute hrefs.

### 4.8 Error page [test]
- Image alt "A cat and a dog".
- h2 "Something happened...".
- A paragraph with the error message.
- HTTP **200**.
- Legacy shows the raw exception message, e.g. JPQL for an unknown owner. Modern shows a plain message; only `/oups`'s text is pinned.

---

## 5. Business rules

### 5.1 Owner search [test]
- `lastName` is a **case-insensitive prefix** match:
  - `dav`, `DAV` and `davis` find both Davises.
  - `avis` finds nothing.
- Legacy is case-insensitive only because the H2 column is `VARCHAR_IGNORECASE`; plain Postgres LIKE is case-sensitive. Modern: `last_name ILIKE $1 || '%'`.
- No trim. LIKE wildcards are not escaped: legacy treats `%` and `_` as wildcards [obs]. Parity: keep them unescaped.
- Results:
  - 0 results: form error `has not been found`.
  - 1 result: redirect to `/owners/{id}`.
  - 2 or more: the list.
- A missing or empty `lastName` returns all owners. Order is `ORDER BY id`.

### 5.2 Sorting
- **Pets of an owner:** by name, case-insensitive (Java `String.CASE_INSENSITIVE_ORDER`). In JS, compare the lowercased strings by code unit, not with `localeCompare` [test].
- **Visits of a pet:** date descending [test]. Same-date ties have no defined order.
- **Vets:** last name, then first name. **Specialties:** by name [test].
- **Pet types:** by name [test].

### 5.3 Pets [test]
- The duplicate-name check runs on **create only**, comparing names case-insensitively against the owner's saved pets. Message: `is already in use`.
- On **edit**, renaming a pet to a sibling's name is allowed [test].
- The same name under different owners is allowed [test].
- Future birth dates are accepted [test].
- `type` is required on create only [code].

### 5.4 Visits
- `date` defaults to today, using the server's date [test].
- Date is **not required** in legacy. A blank date is saved as NULL [test @legacy-bug]. See §8.

### 5.5 No deletes
There are no delete operations anywhere [code].

---

## 6. Validation messages [test]

Only **one message per field** is shown. It sits in the innermost element that wraps the field's
input; legacy uses `span.help-inline` inside `div.col-sm-10`.

| Form | Field | Rule | Message |
|---|---|---|---|
| Owner | firstName, lastName, address, city | not empty (whitespace-only **passes**, no trim) | `must not be empty` |
| Owner | telephone | not empty, and parses as a number with ≤10 integer digits and no fraction | `numeric value out of bounds (<10 digits>.<0 digits> expected)` |
| Owner | telephone empty | fails both rules | legacy shows **either** message, varying per request (5/12 vs 7/12 observed) [obs]; tests accept both. **Modern: show `must not be empty`** |
| Pet | name | not empty (whitespace passes) | `is required` |
| Pet | name | duplicate on create (§5.3) | `is already in use` |
| Pet | birthDate | required | `is required` |
| Pet | birthDate | unparseable | `invalid date` |
| Pet | type | required on create | `is required` |
| Visit | description | not empty | `must not be empty` |
| Visit | date | unparseable | `invalid date` |

Telephone examples:
- Accepted: `1`, `1234567890` [test].
- Rejected: `abc`, `12345678901`, `123-456` [test].
- Also accepted by legacy (`@Digits` uses BigDecimal parsing) [code/harness]: `+123`, `-123`, `1e3`. Parity: accept the same: the untrimmed string must parse as a BigDecimal with ≤10 integer digits and scale ≤0.

**Date parsing** (pet birthDate, visit date) [test + harness]:
- Accepted:
  - strict `yyyy/MM/dd`
  - ISO `yyyy-MM-dd`
- Rejected:
  - invalid calendar dates, e.g. `2020/02/30`
  - one-digit month or day
  - surrounding spaces
- Empty or whitespace-only input means "no date": `is required` for a pet; allowed for a visit.

**Error precedence** (two errors on one field): a parse error (`invalid date`) wins over `is required` [code].

Several errors on different fields are reported together [test]. Example: invalid date plus empty description.

---

## 7. Data

### 7.1 Schema (Postgres)

Based on `legacy/src/main/resources/db/postgresql/schema.sql`:
```
vets            (id serial PK, first_name varchar(30), last_name varchar(30))
specialties     (id serial PK, name varchar(80))
vet_specialties (vet_id int NOT NULL FK vets, specialty_id int NOT NULL FK specialties, UNIQUE(vet_id, specialty_id))
types           (id serial PK, name varchar(80))
owners          (id serial PK, first_name varchar(30), last_name varchar(30), address varchar(255), city varchar(80), telephone varchar(20))
pets            (id serial PK, name varchar(30), birth_date date, type_id int NOT NULL FK types, owner_id int NOT NULL FK owners)
visits          (id serial PK, pet_id int NOT NULL FK pets, visit_date date, description varchar(255))
```
- Indexes on `owners.last_name`, `pets.name`, `vets.last_name` and `visits.pet_id`.
- After seeding, set each sequence to `max(id)`.
- **No length validation exists in legacy.** An overlong value fails at insert and shows the friendly error page [code]. Modern can keep that or add max-length validation; this is not tested.

### 7.2 Seed data: use the H2 values

**Do not use `db/postgresql/data.sql`.** It has different pet birth dates and visit dates, and would
reverse visit order. Use `db/h2/data.sql`:

**Owners** (id, first, last, address, city, telephone):

| id | first | last | address | city | telephone |
|---|---|---|---|---|---|
| 1 | George | Franklin | 110 W. Liberty St. | Madison | 6085551023 |
| 2 | Betty | Davis | 638 Cardinal Ave. | Sun Prairie | 6085551749 |
| 3 | Eduardo | Rodriquez | 2693 Commerce St. | McFarland | 6085558763 |
| 4 | Harold | Davis | 563 Friendly St. | Windsor | 6085553198 |
| 5 | Peter | McTavish | 2387 S. Fair Way | Madison | 6085552765 |
| 6 | Jean | Coleman | 105 N. Lake St. | Monona | 6085552654 |
| 7 | Jeff | Black | 1450 Oak Blvd. | Monona | 6085555387 |
| 8 | Maria | Escobito | 345 Maple St. | Madison | 6085557683 |
| 9 | David | Schroeder | 2749 Blackhawk Trail | Madison | 6085559435 |
| 10 | Carlos | Estaban | 2335 Independence La. | Waunakee | 6085555487 |

**Types:** 1 cat, 2 dog, 3 lizard, 4 snake, 5 bird, 6 hamster.

**Pets** (id, name, birth date, type id, owner id):

| id | name | birth date | type | owner |
|---|---|---|---|---|
| 1 | Leo | 2010-09-07 | 1 | 1 |
| 2 | Basil | 2012-08-06 | 6 | 2 |
| 3 | Rosy | 2011-04-17 | 2 | 3 |
| 4 | Jewel | 2010-03-07 | 2 | 3 |
| 5 | Iggy | 2010-11-30 | 3 | 4 |
| 6 | George | 2010-01-20 | 4 | 5 |
| 7 | Samantha | 2012-09-04 | 1 | 6 |
| 8 | Max | 2012-09-04 | 1 | 6 |
| 9 | Lucky | 2011-08-06 | 5 | 7 |
| 10 | Mulligan | 2007-02-24 | 2 | 8 |
| 11 | Freddy | 2010-03-09 | 5 | 9 |
| 12 | Lucky | 2010-06-24 | 2 | 10 |
| 13 | Sly | 2012-06-08 | 1 | 10 |

**Visits** (id, pet id, date, description):

| id | pet | date | description |
|---|---|---|---|
| 1 | 7 | 2013-01-01 | rabies shot |
| 2 | 8 | 2013-01-02 | rabies shot |
| 3 | 8 | 2013-01-03 | neutered |
| 4 | 7 | 2013-01-04 | spayed |

**Vets:**

| id | first | last |
|---|---|---|
| 1 | James | Carter |
| 2 | Helen | Leary |
| 3 | Linda | Douglas |
| 4 | Rafael | Ortega |
| 5 | Henry | Stevens |
| 6 | Sharon | Jenkins |

**Specialties:** 1 radiology, 2 surgery, 3 dentistry.

**vet_specialties:** (2,1), (3,2), (3,3), (4,2), (5,1).

### 7.3 `/vets.json` and `/vets.xml` [test]

Exact bodies are in `tests/characterization/specs/vets.spec.ts`.

**JSON:**
- `{"vetList":[...]}`. Each vet has `firstName, id, lastName, new:false, nrOfSpecialties, specialties:[{id,name,new:false}]`.
- Content-Type `application/json`.

**XML:**
- One line, no whitespace.
- Content-Type `application/xml`.
- No `new` or `nrOfSpecialties`.
- Each specialty is a repeated `<specialties><id/><name/></specialties>`, omitted when a vet has none.

---

## 8. Known legacy defects (decide: reproduce or fix)

Tests for these are tagged `@legacy-bug`. The default suite excludes them
(`INCLUDE_LEGACY_BUGS=1` runs them).

**Decision: fix all of them in modern.** They are documented as findings after the
migration (fix_plan task 23). Each fix also gets a line in NOTES.md.

| # | Legacy behavior | Evidence | Modern behavior (fix) |
|---|---|---|---|
| D1 | Blank visit date is saved as NULL. Once the pet has 2+ visits, the owner page returns HTTP 500 (null-hostile sort, Pet.java:101) | [test @legacy-bug] | Require the date: blank → `is required` |
| D2 | A rejected owner edit re-renders as "New Owner" / "Add Owner" (bound owner has no id) | [test @legacy-bug] | Keep the "Owner" / "Update Owner" labels |
| D3 | `/owners/{o}/pets/{p}/visits` returns 404 (missing view) | [test @legacy-bug] | 404 (same result; no page) |
| D4 | Edit of an unknown pet id returns a raw 500 | [test @legacy-bug] | Friendly error page, 200 (consistent with unknown owner) |
| D5 | Unknown pet type shows Java's conversion error (reflected unescaped, so XSS) | [test @legacy-bug] | Reject in the API with field message `invalid value` (the UI select cannot send it) |
| D6 | Error messages and `${exception.message}` are rendered unescaped | [code] | React escapes everything |
| D7 | Pet edit trusts the hidden form `id`, not `{petId}`; posting can move a pet to another owner or overwrite pets | [code] | Use the path ids; API ignores body ids |
| D8 | Pet and visit routes never check that the pet belongs to `{ownerId}` | [obs] | Keep lenient (parity), not tested |
| D9 | Empty telephone shows a random one of two messages | [obs] | Always `must not be empty` |
| D10 | German messages mojibake (`ungÃ¼ltiges Datum`); mixed languages for unsupported locales | [harness] | i18n not ported |
| D11 | Dates with signed years over 4 digits (`+12345-01-01`) are accepted through java.time's ISO fallback | [harness], code review of PR #20 | Accepted divergence: modern accepts 4-digit years only. No user relies on year 12345, and modern already rejects year 0 because Postgres cannot store it |
