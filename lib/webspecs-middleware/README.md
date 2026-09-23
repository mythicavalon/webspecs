# WebSpecs Express middleware

The middleware is deliberately storage-agnostic:

```ts
app.use(
  createWebSpecsMiddleware({
    store: { insert: (event) => myLogger.write(event) },
    hashSalt: process.env.WEBSPECS_HASH_SALT!,
    onStoreError: (error) => myLogger.error(error),
  }),
);
```

It records every request after the response finishes, adds a short-lived
`X-WebSpecs-Request-Id` response header, and never sends data to a WebSpecs
service. Storage errors must be handled through `onStoreError`; if no handler
is supplied, the error is rethrown so an integration cannot silently lose
events. Use the classifier package directly if Express is not your stack.