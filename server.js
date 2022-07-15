import { Application } from "https://deno.land/x/abc@v1.3.1/mod.ts";
import { abcCors } from "https://deno.land/x/cors/mod.ts";
import { LocalStorage } from "https://deno.land/x/storage@0.0.5/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";

// config({ path: `./.env.${DENO_ENV}`, export: true });
// const DENO_ENV = Deno.env.get("DENO_ENV") ?? "development";
const store = new LocalStorage("shortenings");
const counter = new LocalStorage("counter");
const privateLink = new LocalStorage("private");
const privateCount = new LocalStorage("privateCount");
const corsConditions = abcCors({
  origin: "http://localhost:3000",
});

const app = new Application();
//const PORT = parseInt(Deno.env.get("PORT")) || 8080;
const default_port = 8080;
const { args } = Deno;
const arg_port = parse(args).port;

function randomFour() {
  const characters = ["a", "e", "r", "i", "k", "o", "u", "1", "5", "8"];
  let i = 0;
  let str = "";
  while (i < 4) {
    str += characters[Math.floor(Math.random() * characters.length)];
    i++;
  }
  return str;
}

async function validateURL(url) {
  let valid;
  try {
    if (await fetch(url)) {
      valid = true;
    }
  } catch {
    valid = false;
  }
  return valid;
}

app
  .use(abcCors())
  .get("/", (server) => {
    server.json({}, 200);
  })
  .get("/urls", (server) => {
    return server.json(store);
  })
  .get("/privateLinks", (server) => {
    return server.json([privateLink, privateCount]);
  })
  .get("/visits", (server) => {
    return server.json(counter);
  })
  .get("/visits/:shortcode", (server) => {
    const { shortcode } = server.params;
    let currentCount = counter.get(shortcode);
    return server.json("Visited " + currentCount + " times", 200);
  })
  .get("/l/:shortcode", async (server) => {
    const { shortcode } = server.params;
    if (shortcode) {
      console.log(shortcode);
      const theURL = await store.get(shortcode);
      const privateURL = await privateLink.get(shortcode);
      let currentCount = await counter.get(shortcode);
      let currentCountPrivate = await privateCount.get(shortcode);
      let valid = await validateURL(theURL);
      let privateValid = await validateURL(privateURL);
      console.log(valid);

      if (valid) {
        counter.set(shortcode, currentCount + 1);
        server.redirect(theURL);
      } else if (privateValid) {
        privateCount.set(shortcode, currentCountPrivate + 1);
        server.redirect(privateURL);
      } else {
        console.log("URL not valid");
        return server.json({ Error: "URL is not valid :(" }, 404);
      }
    } else {
      console.log("no url");
      return server.json({ Error: "Nottt found" }, 404);
    }
  })
  .post("/shortlinks", async (server) => {
    console.log("posting...");
    const body = await server.body;
    const url = body.fullUrl;
    let isPrivate = body.isPrivate;
    let valid = await validateURL(url);
    if (valid) {
      const four = randomFour();
      console.log(isPrivate);
      if (isPrivate) {
        await privateLink.set(four, url);
        await privateCount.set(four, 0);
      } else {
        await store.set(four, url);
        await counter.set(four, 0);
      }
      return server.json({ shortcode: four }, 200);
    } else {
      console.log("bad url :(");
      return server.json({ Error: "bad url :(" }, 404);
    }
  })
  .delete("/:shortcode", async (server) => {
    const { shortcode } = server.params;
    const publicCode = await store.get(shortcode);
    const privateCode = await privateLink.get(shortcode);
    if (publicCode) {
      store.delete(shortcode);
      counter.delete(shortcode);
      return server.json("Link deleted!", 200);
    } else if (privateCode) {
      privateLink.delete(shortcode);
      privateCount.delete(shortcode);
      return server.json("Private link deleted!", 200);
    } else {
      return server.json({ Error: "Invalid short code" }, 400);
    }
  })
  .start({ port: arg_port ? Number(arg_port) : default_port });

console.log(`Server running on http://localhost:${default_port}`);
