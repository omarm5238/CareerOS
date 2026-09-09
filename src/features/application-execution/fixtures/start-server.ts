import { startFixtureServer } from "./server";

void startFixtureServer().then(({ origin }) => {
  console.log(`M24.5B fixtures listening on ${origin}`);
});
