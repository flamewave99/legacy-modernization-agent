# Legacy-defect findings

The defects found in the legacy app while specifying it (SPEC.md §8), and what modern does instead.
Decision (SPEC §8): fix the defects rather than reproduce them. Seven are fixed (D1, D2, D4–D7, D9). D8 is kept for parity, D3 behaves the same by design, D10 goes away because i18n is not ported, and D11 is an accepted divergence.

Legacy file paths are relative to `legacy/src/main/`. The legacy app runs with the default `jpa`
profile (`PetclinicInitializer.java:51`), so the JPA repositories are the ones that matter.

## How this was checked

The `@legacy-bug` tests (`tests/characterization/specs/legacy-bugs.spec.ts`) pin the legacy behavior.
Run with `INCLUDE_LEGACY_BUGS=1`:

| Test | Legacy (`$LEGACY_URL`) | Modern (`:3000`) | Defect |
|---|---|---|---|
| empty visit date is accepted; owner page still renders while it is the only visit | pass | **fail**: the visit POST is 422, not 302 | D1 |
| empty visit date plus any other visit on the pet makes the owner page 500 | pass | **fail** (see D1 note) | D1 |
| a rejected owner edit re-renders as "New Owner" with an "Add Owner" button | pass | **fail**: the heading stays "Owner" | D2 |
| the visits list route has no view and returns 404 | pass | pass: 404 too | D3 |
| editing a pet id that does not exist returns 500 | pass | **fail**: 200 (error page) | D4 |
| unknown pet type leaks a Java conversion error message | pass | **fail**: 404, there is no form POST route | D5 |

Every failure against modern is a fix listed in SPEC §8, and the one pass (D3) is the defect whose
modern behavior is "same result". D6, D7, D9 and D10 have no `@legacy-bug` test; they are covered by
the unit tests named below.

## D1: a blank visit date is saved, then breaks the owner page

- **Legacy:** a visit with an empty date is saved with `visit_date` NULL (redirect 302). While it is
  the pet's only visit the owner page renders; once the pet has a second visit, `/owners/{id}` is a
  raw HTTP 500.
- **Root cause:** `Visit.java:40-42` has no `@NotNull` on `date`, so the binder turns `""` into
  `null` and validation passes. `Pet.java:101` sorts with `Comparator.comparing(Visit::getDate)`,
  which throws `NullPointerException` on a null date; Java skips the comparator for lists of fewer
  than 2, hence the second-visit trigger. The NPE is thrown while `ownerDetails.jsp:67` renders
  `${pet.visits}`, after the `SimpleMappingExceptionResolver` could catch it, so Tomcat answers 500.
- **Modern:** the date is required; blank gives `is required` (`modern/api/src/domain/visit.ts:24`).
  The visit sort also puts any NULL date last instead of failing (`modern/api/src/domain/sorting.ts:56`).
- **Tests:** `@legacy-bug empty visit date is accepted…` fails against modern with 422. Unit:
  `visit-write-routes.test.ts` "requires a date (D1 fix)" and `sorting.test.ts` "puts the newest
  visit first and any NULL date last".
- **Note:** the second test (`…makes the owner page 500`) fails against modern earlier than the fix:
  its first, dated visit is answered 201 by `/api/.../visits` rather than legacy's 302, because the
  modern form posts JSON to the API. Its 500 cannot happen in modern either, as no NULL date is saved.

## D2: a rejected owner edit turns into "New Owner"

- **Legacy:** submitting `/owners/{id}/edit` with an invalid field re-renders the form with the
  heading "New Owner" and the button "Add Owner", although the URL is still the edit URL.
- **Root cause:** `OwnerController.java:50` disallows binding `id`, and `processUpdateOwnerForm`
  returns the form on errors (`OwnerController.java:110-111`) before `owner.setId(ownerId)` at line
  114. The bound owner has no id, so `BaseEntity.isNew()` (`BaseEntity.java:43-44`) is true and
  `createOrUpdateOwnerForm.jsp:11,24` pick the "new" labels.
- **Modern:** the form keeps "Owner" / "Update Owner" after a rejected edit
  (`modern/web/src/pages/OwnerForm.tsx:39`).
- **Tests:** `@legacy-bug a rejected owner edit re-renders as "New Owner"…` fails against modern.
  Unit: `owner-form.test.tsx` "edit: pre-filled, "Owner" and "Update Owner", also with errors (D2 fix)".

## D3: the visits list route has no view

- **Legacy:** `GET /owners/{o}/pets/{p}/visits` is 404.
- **Root cause:** `VisitController.java:85-89` maps the route and returns view `visitList`, but there
  is no `WEB-INF/jsp/visitList.jsp`, so the forwarded JSP is a 404.
- **Modern:** no such page; the route is not among the page routes (`modern/api/src/routes/pages.ts`),
  so it is 404 as well. Same result by decision.
- **Tests:** `@legacy-bug the visits list route has no view and returns 404` passes against both.

## D4: editing an unknown pet is a raw 500

- **Legacy:** `GET /owners/1/pets/999999/edit` is Tomcat's 500 page with a stack trace
  (`Neither BindingResult nor plain target object for bean name 'pet'`). An unknown owner, by
  contrast, gets the friendly error page with 200.
- **Root cause:** `JpaPetRepositoryImpl.java:53` uses `em.find`, which returns `null` for an unknown
  id; `PetController.java:93-96` puts that `null` in the model, and the form's `spring:bind`
  (`tags/inputField.tag:9`) throws while the view renders, outside the exception resolver
  (`spring/mvc-core-config.xml:60-66`).
- **Modern:** the page route answers 200 and the pet form shows the error page when the pet is
  unknown (`modern/web/src/pages/PetForm.tsx:240-249`), consistent with an unknown owner.
- **Tests:** `@legacy-bug editing a pet id that does not exist returns 500` fails against modern (200).

## D5: an unknown pet type leaks a Java conversion error (and is XSS)

- **Legacy:** posting `type=dragon` to `/owners/{id}/pets/new` re-renders the form with
  `Failed to convert property value of type 'java.lang.String' to required type '…PetType'…`
  under the type field, including the submitted text unescaped.
- **Root cause:** `PetTypeFormatter.java:62` throws `ParseException("type not found: " + text)`;
  there is no `typeMismatch.type` message in `messages/messages.properties`, so Spring's default
  conversion message is shown, and `tags/selectField.tag:26` writes `${status.errorMessage}`
  without escaping.
- **Modern:** the API rejects an unknown type name with the field message `invalid value`
  (`modern/api/src/domain/pet.ts:50`); the UI's select cannot send one. There is no form POST
  route, so the legacy request itself is 404.
- **Tests:** `@legacy-bug unknown pet type leaks a Java conversion error message` fails against
  modern. Unit: `pet-write-routes.test.ts` "rejects an unknown type name with invalid value (D5)".

## D6: messages are rendered unescaped

- **Legacy:** field errors and the exception message are written as raw HTML, so user input that
  ends up in a message (D5) or in an exception text is interpreted by the browser.
- **Root cause:** `tags/inputField.tag:22` and `tags/selectField.tag:26` write
  `${status.errorMessage}`, and `jsp/exception.jsp:12` writes `${exception.message}`, all with EL
  instead of `<c:out>`.
- **Modern:** React escapes all text; the preloaded JSON embedded in `index.html` escapes `<`.
- **Tests:** unit `error-page.test.tsx` "escapes the message", `owner-details.test.tsx` "escapes
  user data", `page-routes.test.ts` "escapes < so data cannot close the script element".

## D7: pet edit trusts the hidden form id

- **Legacy:** the pet form posts a hidden `id`; changing it lets a request to
  `/owners/{o}/pets/{p}/edit` overwrite any pet, and attach it to owner `{o}`.
- **Root cause:** `pets/createOrUpdatePetForm.jsp:21` sends `<input type="hidden" name="id">`; the
  pet binder (`PetController.java:64-67`) does not disallow `id` (only the owner binder at line 61
  does); `processUpdateForm` (`PetController.java:99-108`) never reads `{petId}`, adds the bound pet
  to the path's owner and saves it with `em.merge` (`JpaPetRepositoryImpl.java:61`).
- **Modern:** the API uses the path ids only, ignores body ids, and updates with
  `WHERE id = $petId AND owner_id = $ownerId`, so a pet can never move owners
  (`modern/api/src/writes.ts:52-54`, `modern/api/src/routes/pets-write.ts:4`).
- **Tests:** unit `pet-write-routes.test.ts` "ignores ids in the body (D7)", "uses the path ids,
  never body ids (D7)" and "returns 404 for another owner's pet and leaves it unchanged".

## D8: pet and visit routes do not check the owner

- **Legacy:** `/owners/1/pets/7/visits/new` shows and adds visits for owner 6's pet; the pet edit
  form loads a pet by id whatever the owner in the URL.
- **Root cause:** `VisitController.java:60-66` loads the pet from `{petId}` alone and line 69 maps
  `/owners/*/…`; `PetController.java:93-94` loads by `petId` alone.
- **Modern:** kept lenient for parity (the only defect not fixed): visits use `GET /api/pets/:petId`
  and the visit POST checks only the pet (`modern/api/src/routes/visits-write.ts:3`). Pet updates
  are still protected by the D7 fix.
- **Tests:** unit `visit-write-routes.test.ts` "does not check that the pet belongs to the owner
  (D8, parity)" and `read-routes.test.ts` "ignores the owner id in the path, like legacy (D8)".

## D9: an empty telephone shows a random message

- **Legacy:** an empty telephone shows either `must not be empty` or
  `numeric value out of bounds (<10 digits>.<0 digits> expected)`, varying per request (5/12 vs 7/12 observed, SPEC §6).
- **Root cause:** `Owner.java:55-56` puts both `@NotEmpty` and `@Digits(integer = 10)` on
  `telephone`, and both fail for `""`. `inputField.tag:22` shows `status.errorMessage`, the first
  error, and Hibernate Validator does not order violations of one property.
- **Modern:** one message per field; empty is always `must not be empty`
  (`modern/api/src/domain/owner.ts:23-29`).
- **Tests:** unit `owner.test.ts` "gives an empty telephone only must not be empty (D9)" and
  `owner-write-routes.test.ts` "gives an empty telephone must not be empty (D9)".

## D10: German messages are mojibake

- **Legacy:** with `Accept-Language: de`, `invalid date` shows as `ungÃ¼ltiges Datum`; locales
  without a bundle mix languages.
- **Root cause:** `spring/mvc-core-config.xml:53-54` declares a `ResourceBundleMessageSource` with
  no `defaultEncoding`, so `messages/messages_de.properties`, saved as UTF-8, is read as ISO-8859-1.
- **Modern:** i18n is not ported (SPEC §2); every message is English.
- **Tests:** none; the characterization suite pins `en-US`.

## D11: years over 4 digits are accepted

- Accepted divergence, not a fix: legacy accepts `+12345-01-01` through java.time's ISO fallback;
  modern accepts 4-digit years only (SPEC §8). No test.
