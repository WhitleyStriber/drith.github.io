# Live server status

`status_server.py` runs on the box next to the game server and answers one
question over HTTP: is the thing up?

```json
{"online": true, "address": "203.0.113.24:27015", "port": 27015, "checked": "2026-08-01T20:14:03Z"}
```

The PLAY panel fetches that and shows **ONLINE** with the access code, or
**SERVER OFFLINE**. Set `status_url` in `_config.yml` to wherever this ends up
answering. Leave it empty and the panel goes back to the old build-time
behaviour: an address in `server_ip` means online, no address means offline.

Run it with `--address auto` and it finds the box's own public IP rather than
being told it — see [The address](#the-address).

Python 3.7+, standard library only.

## Read this before anything else: it has to be HTTPS

The site is served from `github.io`, so the page is HTTPS. Browsers refuse to
let an HTTPS page fetch an `http://` URL — the request is blocked as mixed
content, the panel gets nothing back, and it reads SERVER OFFLINE forever. Any
of these fixes it:

**Cloudflare Tunnel** — easiest for a home box. Free TLS, and no port
forwarding, so the game box never exposes the status port to the internet:

```bash
python3 status_server.py --address auto &
cloudflared tunnel --url http://localhost:27016
```

That prints a `https://something.trycloudflare.com` URL — that plus `/status`
is your `status_url`. Quick tunnels get a new URL each restart; `cloudflared
tunnel create` + a named hostname keeps it stable.

**Caddy**, if you already have a domain pointed at the box — certificates are
automatic:

```
status.yourdomain.com {
    reverse_proxy localhost:27016
}
```

**Certificate you already hold** — skip the proxy, serve TLS directly:

```bash
python3 status_server.py --cert fullchain.pem --key privkey.pem --port 443
```

## Running it

```bash
python3 status_server.py --address auto
```

| Flag | Default | |
|---|---|---|
| `--game-port` | `27015` | port the game server runs on |
| `--game-host` | `0.0.0.0` | address the game binds — match it, or the bind probe can miss |
| `--port` | `27016` | port to serve status on |
| `--listen` | `0.0.0.0` | `127.0.0.1` is right when a proxy or tunnel fronts it |
| `--address` | — | access code handed to players, or `auto`; overrides `server_ip` from the site build |
| `--origin` | `*` | `Access-Control-Allow-Origin` |
| `--probe` | `bind` | `bind` or `tcp` |
| `--cert` / `--key` | — | serve HTTPS directly |
| `--verbose` | off | log every request |

`--address` is the useful one: change ports and you edit the flag, not the
site. Set `--origin https://whitleystriber.github.io` once the URL is settled
so other people's pages can't poll your box through a visitor's browser.

## The address

The access code is a home IP on a DHCP lease, so it moves. Bake it into
`_config.yml` and the site keeps handing out the old one after every lease
change — nothing breaks loudly, players just copy a code that dials nowhere.

`--address auto` asks an echo service (ipify, then AWS, then icanhazip) what
this box's public IPv4 is, pairs it with `--game-port`, and re-asks every five
minutes, so the panel publishes whatever address the box actually has. The
lookups happen on a background thread and never inside a request — a slow
one would otherwise eat the four seconds the page waits before it decides the
server is down. A failed round keeps the last good answer, since the echo
services being unreachable is not the same as the address having changed.

IPv4 only: the answers come back as v6 on a box that prefers it, and the game
binds v4, so a v6 answer would publish a code nobody's client can dial.

`server_ip` in `_config.yml` stays worth setting — it is what the page shows
before the fetch lands, and all it has if no responder is configured — but
with `auto` running, the responder's answer wins and the site build stops
being the thing that has to keep up.

### systemd

`/etc/systemd/system/drith-status.service`:

```ini
[Unit]
Description=Drith server status
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/drith/status_server.py --address auto --listen 127.0.0.1
Restart=always
RestartSec=5
User=drith

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now drith-status
```

Leave this running all the time — it's what reports the game server as *down*,
so it needs to outlive it. It's a few MB of Python sitting idle.

### Windows

Task Scheduler, "At startup", `pythonw.exe C:\drith\status_server.py --address
...`. Allow the status port through Windows Firewall if it's exposed directly
(not needed behind a tunnel).

## What "online" actually means

The default `bind` probe tries to bind the game's UDP port. The kernel refuses
if the game server already owns it, and that refusal is the signal. It never
has to speak ENet, so it keeps working if you change netcode — but note:

- **Same box only.** It's asking the local kernel who owns a port.
- It means *a process holds that port*, not *the game is answering players*. A
  wedged server still reads online.
- If the game binds one specific interface rather than `0.0.0.0`, pass the same
  `--game-host` or the probe binds a different address and reports offline.
- Use `--probe tcp` instead if the port ever becomes TCP.

If the whole box is off the network the fetch just fails, and the page treats
that as offline — which is what you want, since it is. The gap is the other
way round: if this responder dies while the game keeps running, the panel says
offline. Hence `Restart=always`.

The reading is cached for 3 seconds, so a rush of page loads is still one
probe. The page re-checks when someone opens the panel, and every 30s while
they leave it open.
