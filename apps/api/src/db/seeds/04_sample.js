import { seedSample } from '../seeding/index.js';
import { seedSampleContent } from '../seeding/sampleContent.js';

export const seed = async (knex) => {
  await seedSample(knex);
  await seedSampleContent(knex);
};
