/** Validates req.body / req.query / req.params with Zod schemas from packages/shared (spec 10.1). */
export const validate =
  ({ body, query, params } = {}) =>
  (req, _res, next) => {
    try {
      if (body) req.body = body.parse(req.body ?? {});
      if (query) req.validatedQuery = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
