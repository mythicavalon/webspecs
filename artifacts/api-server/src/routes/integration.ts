import { Router, type IRouter } from "express";
import { readFileSync } from "node:fs";

const snippetJs = readFileSync(
  new URL("../../../lib/webspecs-snippet/src/snippet.js", import.meta.url),
  "utf8",
);

const router: IRouter = Router();

router.get("/snippet.js", (_request, response) => {
  response
    .type("application/javascript")
    .set("Cache-Control", "public, max-age=300")
    .send(snippetJs);
});

export default router;