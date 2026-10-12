// Legacy vets endpoints [SPEC §7.3, fix_plan task 10]. VetController serializes the `Vets` wrapper
// with Jackson (JSON) and JAXB (XML); the bodies below reproduce those serializers byte for byte.

import type { FastifyInstance } from 'fastify';
import { findVets, type Vet } from '../queries.js';

export function registerLegacyVetsRoutes(app: FastifyInstance): void {
  app.get('/vets.json', async (_req, reply) => {
    const vets = await findVets(app.db);
    return reply.type('application/json;charset=UTF-8').send(vetsJson(vets));
  });

  app.get('/vets.xml', async (_req, reply) => {
    const vets = await findVets(app.db);
    return reply.type('application/xml;charset=UTF-8').send(vetsXml(vets));
  });
}

/**
 * Jackson writes bean getters in alphabetical order, so `isNew()` and `getNrOfSpecialties()` appear
 * as `new` and `nrOfSpecialties`. Entities loaded from the DB always have an id, so `new` is false.
 */
export function vetsJson(vets: readonly Vet[]): string {
  return JSON.stringify({
    vetList: vets.map((v) => ({
      firstName: v.firstName,
      id: v.id,
      lastName: v.lastName,
      new: false,
      nrOfSpecialties: v.specialties.length,
      specialties: v.specialties.map((s) => ({ id: s.id, name: s.name, new: false })),
    })),
  });
}

/**
 * JAXB output: one line, field order id, firstName, lastName, then one `<specialties>` element per
 * specialty (none when empty). `isNew()` and `getNrOfSpecialties()` are not JAXB properties.
 */
export function vetsXml(vets: readonly Vet[]): string {
  const body = vets
    .map(
      (v) =>
        `<vet><id>${String(v.id)}</id><firstName>${escapeXml(v.firstName)}</firstName>` +
        `<lastName>${escapeXml(v.lastName)}</lastName>` +
        v.specialties
          .map(
            (s) =>
              `<specialties><id>${String(s.id)}</id><name>${escapeXml(s.name)}</name></specialties>`,
          )
          .join('') +
        '</vet>',
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><vets>${body}</vets>`;
}

/** JAXB's default escape handler for element text: `&`, `<` and `>` only. */
function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
