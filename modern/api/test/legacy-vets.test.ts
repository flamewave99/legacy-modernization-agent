import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { vetsXml } from '../src/routes/legacy-vets.js';
import { resetDatabase } from '../src/reset.js';

// Bodies captured from the running legacy app (GET /vets.json and /vets.xml on the H2 seed).
const LEGACY_JSON =
  '{"vetList":[{"firstName":"James","id":1,"lastName":"Carter","new":false,"nrOfSpecialties":0,"specialties":[]},' +
  '{"firstName":"Linda","id":3,"lastName":"Douglas","new":false,"nrOfSpecialties":2,"specialties":[{"id":3,"name":"dentistry","new":false},{"id":2,"name":"surgery","new":false}]},' +
  '{"firstName":"Sharon","id":6,"lastName":"Jenkins","new":false,"nrOfSpecialties":0,"specialties":[]},' +
  '{"firstName":"Helen","id":2,"lastName":"Leary","new":false,"nrOfSpecialties":1,"specialties":[{"id":1,"name":"radiology","new":false}]},' +
  '{"firstName":"Rafael","id":4,"lastName":"Ortega","new":false,"nrOfSpecialties":1,"specialties":[{"id":2,"name":"surgery","new":false}]},' +
  '{"firstName":"Henry","id":5,"lastName":"Stevens","new":false,"nrOfSpecialties":1,"specialties":[{"id":1,"name":"radiology","new":false}]}]}';

const LEGACY_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><vets>' +
  '<vet><id>1</id><firstName>James</firstName><lastName>Carter</lastName></vet>' +
  '<vet><id>3</id><firstName>Linda</firstName><lastName>Douglas</lastName>' +
  '<specialties><id>3</id><name>dentistry</name></specialties>' +
  '<specialties><id>2</id><name>surgery</name></specialties></vet>' +
  '<vet><id>6</id><firstName>Sharon</firstName><lastName>Jenkins</lastName></vet>' +
  '<vet><id>2</id><firstName>Helen</firstName><lastName>Leary</lastName>' +
  '<specialties><id>1</id><name>radiology</name></specialties></vet>' +
  '<vet><id>4</id><firstName>Rafael</firstName><lastName>Ortega</lastName>' +
  '<specialties><id>2</id><name>surgery</name></specialties></vet>' +
  '<vet><id>5</id><firstName>Henry</firstName><lastName>Stevens</lastName>' +
  '<specialties><id>1</id><name>radiology</name></specialties></vet>' +
  '</vets>';

describe('legacy vets endpoints', () => {
  const app = buildApp({ logger: false });

  beforeAll(() => resetDatabase(app.config.databaseUrl));
  afterAll(() => app.close());

  it('GET /vets.json returns the legacy body byte for byte', async () => {
    const res = await app.inject({ method: 'GET', url: '/vets.json' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/json;charset=UTF-8');
    expect(res.body).toBe(LEGACY_JSON);
  });

  it('GET /vets.xml returns the legacy body byte for byte', async () => {
    const res = await app.inject({ method: 'GET', url: '/vets.xml' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/xml;charset=UTF-8');
    expect(res.body).toBe(LEGACY_XML);
  });
});

describe('vetsXml', () => {
  it('escapes &, < and > in text', () => {
    const xml = vetsXml([
      { id: 7, firstName: 'A&B', lastName: '<x>', specialties: [{ id: 1, name: 'a"b' }] },
    ]);
    expect(xml).toContain(
      '<vet><id>7</id><firstName>A&amp;B</firstName><lastName>&lt;x&gt;</lastName>' +
        '<specialties><id>1</id><name>a"b</name></specialties></vet>',
    );
  });
});
