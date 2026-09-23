# WebSpecs classifier

The classifier is a small, dependency-free module. It does not make network
requests and it does not store data. Import `matchBotSignature` when a logging
pipeline only needs the deterministic User-Agent match, or `classifyRequest`
when it also has the optional browser signal.

The JSON files in `data/` are intentionally checked into the repository. A
signature change is a normal pull request, not a runtime download. The
default ranges are a conservative starter list and should be reviewed before
being expanded because cloud address space is not proof that a request is a
bot.