import { ensureTrustedUrl } from "eslint-plugin-dom-security/runtime";

const l = window.location;
const b = { href: 0 };

window.location.href = location.search;

location.href = ensureTrustedUrl(location.search);

l.href = location.search;
b.href = location.search;

function redirectTo(win, to) {
  win.location.assign(to);
}

navigation.navigate("/a/" + location.search);

document.location = location.search;
