import { seedClubs } from '../seeding/index.js';
export const seed = (knex) => seedClubs(knex);
