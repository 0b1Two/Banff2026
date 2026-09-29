#!/usr/bin/env bash
# Re-encrypts the itinerary and writes index.html at the repo root.
# Usage: BANFF_PW='<password>' tools/build.sh /path/to/plain-itinerary.html
# The readable page is never committed; only the encrypted index.html is.
# Keeping tools/.staticrypt.json (the salt) unchanged keeps the password, the magic link and "remember me" valid.
set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"; REPO="$(dirname "$TOOLS")"; SRC="$(realpath "$1")"
: "${BANFF_PW:?Set BANFF_PW to the page password}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT; cd "$WORK"; cp "$TOOLS/.staticrypt.json" .
python3 - "$SRC" "$TOOLS" <<'PY'
import sys,re
src,tools=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf8').read()
head=open(tools+'/head-tags.html',encoding='utf8').read(); js=open(tools+'/anchor-script.html',encoding='utf8').read()
# Drop anything injected by an earlier build (marked blocks, plus the older unmarked tags), then inject the current version.
s=re.sub(r'<!-- banff:(head|script) -->.*?<!-- /banff:\1 -->\n?','',s,flags=re.S)
s=re.sub(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>\n?','',s)
s=re.sub(r'<meta name="(?:apple-mobile-web-app-title|application-name|apple-mobile-web-app-capable|mobile-web-app-capable|theme-color|robots)"[^>]*>\n?','',s)
s=re.sub(r'<script>\n/\* Garde le lien magique.*?</script>\n?','',s,flags=re.S)
i=s.lower().find('<head>'); assert i>=0, 'no <head>'; i+=len('<head>'); s=s[:i]+'\n'+head+s[i:]
j=s.lower().rfind('</body>'); s=(s[:j]+js+s[j:]) if j>=0 else s+js
open('page.html','w',encoding='utf8').write(s)
PY
npx -y staticrypt@3 page.html -p "$BANFF_PW" -d out --short --remember 0 \
 --template-title "Banff, octobre 2026" \
 --template-instructions "Itinéraire privé. Entrez le mot de passe." \
 --template-button "Ouvrir" --template-placeholder "Mot de passe" \
 --template-remember "Se souvenir de moi" --template-error "Mot de passe incorrect" \
 --template-toggle-show "Afficher" --template-toggle-hide "Masquer" \
 --template-color-primary "#0A7680" --template-color-secondary "#F7F9F8" >/dev/null
python3 - "$TOOLS" "$REPO" "$SRC" <<'PY'
import sys,re,html
tools,repo,src=sys.argv[1:4]
s=open('out/page.html',encoding='utf8').read()
head=open(tools+'/head-tags.html',encoding='utf8').read()
i=s.find('</head>'); s=s[:i]+head+s[i:]
plain=open(src,encoding='utf8').read()
body=re.sub(r'<(style|script|svg)\b.*?</\1>','',plain,flags=re.S)
words=[w for w in html.unescape(re.sub(r'<[^>]+>',' ',body)).split() if len(w)>7][:40]
leaks=[w for w in words if w in s and w not in ('Banff,',)]
assert len(leaks)<3, 'plaintext leak? '+str(leaks[:5])
open(repo+'/index.html','w',encoding='utf8').write(s)
print('ok: encrypted index.html written')
PY
