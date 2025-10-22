import { ensureTrustedUrl } from "eslint-plugin-dom-security/runtime";

location.href = location.search;

location.href = ensureTrustedUrl(location.search);

function redirectTo(win: Window, to: string) {
  win.location.assign(to);
}

open(location);

function open(a: any) {}

window.open(location);

document.location = new URL(location.href).searchParams.get("redirect_url");

window.location.href =
  new URL(location.href).searchParams.get("redirect_url") ?? "";

const w = globalThis;
w.location.href = location.search;

declare const x: "href";

location[x] = new URL(location.href).searchParams.get("redirect_url") ?? "";
