# VM deployment (Ubuntu/Debian)

How 1time.io itself is deployed, without Docker: two Go instances under systemd
(`1time@8080`, `1time@8081`) behind host nginx (`configs/nginx/1time.conf`), switched
blue/green by a puller. For your own instance, the
[Docker Compose setup](../README.md#self-hosting) is simpler.

```bash
# First time on a fresh host. Note `sudo env` — a plain `sudo VAR=... ./script`
# is refused by the default sudoers, and the install would silently end up with
# empty values.
sudo env REDIS_PASS=... ./scripts/update_vm.sh --init

# After changing nginx config, systemd units or the updater script.
sudo ./scripts/update_vm.sh
```

`update_vm.sh` only provisions: packages (on `--init`), the service user,
`/etc/1time/env`, the nginx config, the units and the `1time-deploy-update.timer`.
It does not install the backend or the static site.

To deploy, push a `deploy-*` tag on a master commit:

```bash
git tag deploy-2026-11-15 origin/master
```

```bash
git push origin deploy-2026-11-15
```

`.github/workflows/deploy.yml` publishes the build to the GitHub release `deploy`.
Within about 2 minutes the timer's `scripts/1time-deploy-update` starts it on the idle
port, waits for `/healthz`, switches nginx, lets the old instance drain for up to
15 minutes, then installs the static site and purges Cloudflare. To roll back, tag an
older master commit. Follow it with `journalctl -u 1time-deploy-update`.

`--init` will **not** overwrite `/etc/1time/env` on a later run, so if the first
attempt captured the wrong values, edit `/etc/1time/env` directly and restart the
live instance (`systemctl restart 1time@<port>`, the port `/etc/nginx/conf.d/1time-live.conf`
points to). No run reads secrets from the command line afterwards, so a deploy
cannot clear a secret by forgetting to pass it.
