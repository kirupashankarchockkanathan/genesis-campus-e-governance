import { seedAdmins } from '../seeding/index.js';
export const seed = (knex) => seedAdmins(knex);
