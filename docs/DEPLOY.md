# Deploying to saylavy.pro

The app is a static bundle. There is no server, no database and no environment
variables — the whole thing is `dist/`, and any static host will serve it.

**Before every deploy:**

```bash
npm run test        # 26 tests: logic, UI, accessibility, a real MP4 export
npm run test:prod   # builds, serves with the real vercel.json headers, exports a film
```

`test:prod` is the one that matters here. It is the only thing that exercises
the Content-Security-Policy and the render-blocking theme script, and those are
the two things that break on deploy and *only* on deploy.

---

## Route 1 — Vercel via GitHub (recommended)

No CLI, no tokens, and every push to `main` redeploys itself.

1. **Import the repository.** At [vercel.com/new](https://vercel.com/new), pick
   `EugenAzxa/Saylavy-videp-editing-tool-`.
2. **Accept the defaults.** `vercel.json` in the repository root already sets the
   framework, build command, output directory and headers. Do not override them
   in the dashboard — dashboard settings win over the file, and the headers are
   load-bearing.
3. **Deploy.** It takes about a minute. You get a `*.vercel.app` URL, which is
   already shareable and already on HTTPS.
4. **Add the domain.** Project → Settings → Domains → add `saylavy.pro`, and
   `www.saylavy.pro` if you want it.
5. **Point the DNS.** See below.

## Route 2 — Vercel CLI

For a one-off deploy without connecting the repository:

```bash
npm i -g vercel
vercel login
vercel --prod
```

`vercel login` opens a browser and cannot run in a non-interactive shell. In CI,
use `vercel --prod --token=$VERCEL_TOKEN` instead.

---

## DNS at GoDaddy

`saylavy.pro` currently uses GoDaddy nameservers (`ns39/ns40.domaincontrol.com`)
and serves a placeholder page. Two records need to change, in GoDaddy's DNS
manager:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `@` | **the IP Vercel shows you** |
| `CNAME` | `www` | `cname.vercel-dns.com` |

**Take the apex `A` record value from Vercel's own domain screen, not from a
blog post or from memory.** Vercel changed the address it hands out for apex
domains, and a stale IP produces a domain that resolves, fails to get a
certificate, and gives no useful error.

Delete GoDaddy's existing parking/forwarding records for `@` and `www` first, or
they will conflict.

Propagation is usually minutes. Vercel issues the certificate automatically once
the records resolve; until then the domain will show a certificate warning,
which is expected and not a misconfiguration.

---

## What to check once it is live

```bash
curl -sI https://saylavy.pro | grep -i "content-security-policy"
```

Then, in a browser:

- The page loads **dark** with no flash of light colours. A flash means
  `/theme.js` did not load — check it is being served and is not `defer`red.
- **"Try it with an example film"** produces three clips. This proves WebCodecs
  encoding works on the live origin.
- **Saving** downloads a playable MP4. This is the whole product in one click.
- The browser console is clean. Any `Refused to …` message is the CSP blocking
  something, and needs a fix in `vercel.json`, not an exception in the code.

---

## Why the headers matter

`vercel.json` sets `connect-src 'self'`. That instructs the browser to refuse
any `fetch`, `XHR` or WebSocket to another origin — so "your videos never leave
this computer" stops being a promise the marketing makes and becomes something
the browser enforces, whatever the code does.

That is worth understanding before anyone relaxes it. If a future feature needs
to talk to an API, this line has to change, and the privacy claim on the front
page has to change with it.

The rest: `frame-ancestors 'none'` prevents the app being embedded and
clickjacked, `object-src 'none'` kills plugin embedding, `no-referrer` stops the
domain leaking into other sites' analytics, and `Permissions-Policy` disables
camera, microphone, geolocation and ad-topic APIs the app never uses.

---

## Other hosts

Nothing here is Vercel-specific except the `vercel.json` format. On Netlify,
Cloudflare Pages or S3 + CloudFront the build is the same (`npm run build`,
publish `dist/`) — but **the headers must be recreated by hand** in
`netlify.toml`, `_headers`, or the CDN config. Without them the CSP is gone and
the privacy guarantee reverts to being merely a claim.
