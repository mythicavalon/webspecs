# WebSpecs browser snippet

Serve `src/snippet.js` from the adopter's own WebSpecs instance:

```html
<meta name="webspecs-request-id" content="{{requestId}}">
<script async src="/analytics/snippet.js"></script>
```

The snippet does not use cookies, local storage, or remote services. It waits
three seconds, records only the browser signal needed by the classifier, and
posts it to the local `/analytics/signal` endpoint. The server-side
integration should render the short-lived request ID into the page as the
`webspecs-request-id` meta tag or `data-request-id` script attribute.