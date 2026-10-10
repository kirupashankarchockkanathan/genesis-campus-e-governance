import { seedHalls } from '../seeding/index.js';
export const seed = (knex) => seedHalls(knex);
