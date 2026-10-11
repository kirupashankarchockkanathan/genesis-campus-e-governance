// Injectable clock so tests never depend on the real date (spec 15.1 rule 4).
let fixed = null;

export const clock = {
  now: () => (fixed ? new Date(fixed.getTime()) : new Date()),
  set: (date) => {
    fixed = date ? new Date(date) : null;
  },
  advance: (ms) => {
    fixed = new Date((fixed ?? new Date()).getTime() + ms);
  },
  reset: () => {
    fixed = null;
  },
};
