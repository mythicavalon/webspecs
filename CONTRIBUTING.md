# Contributing to WebSpecs

WebSpecs is intentionally local-first. Contributions must preserve the
property that the default configuration makes no outbound network calls and
does not export adopter data.

## Bot signature updates

1. Edit `lib/webspecs-classifier/data/bot-signatures.json`.
2. Keep the `version` date current and preserve the source attribution.
3. Add the smallest stable User-Agent substring that identifies the crawler.
   Avoid broad words such as `bot` when they could match ordinary browsers.
4. Choose one category:
   - `training_crawler`: independently crawls, indexes, or collects content.
   - `agent_fetch`: fetches content for a live user request.
5. Add or update a classifier example showing the expected category.
6. Explain the evidence in the pull request. Do not add a signature solely
   because an IP belongs to a cloud provider.
7. Run `pnpm run typecheck` before submitting.

Signature entries are reviewed as behavior changes. Do not download or
auto-apply remote lists at runtime.

## Datacenter ranges

Range changes belong in
`lib/webspecs-classifier/data/datacenter-ranges.json`. Include the provider,
CIDR, source, and a reason. A range is only a weak signal and must not be used
as a standalone bot classification.

## Code changes

Keep the classifier dependency-free, keep the browser snippet framework-free,
and avoid logging full IP addresses. Add documentation when classification
behavior changes.