import { seedGovernance, seedPortalUsers } from '../seeding/governance.js';

export const seed = async (knex) => {
  await seedGovernance(knex);
  await seedPortalUsers(knex);
};
