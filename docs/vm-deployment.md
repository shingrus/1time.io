# VM deployment (Ubuntu/Debian)

How 1time.io itself is deployed, without Docker: the Go binary under systemd behind
host nginx (`configs/nginx/1time.conf`). For your own instance, the
[Docker Compose setup](../README.md#self-hosting) is simpler.

```bash
make build

# First time on a fresh host. Note `sudo env` — a plain `sudo VAR=... ./script`
# is refused by the default sudoers, and the install would silently end up with
# empty values.
sudo env REDIS_PASS=... ./scripts/update_vm.sh --init

# Every deploy after that. Configuration is never touched.
sudo ./scripts/update_vm.sh
```

`--init` installs nginx and Redis, creates the service user, and writes
`/etc/1time/env`. It will **not** overwrite that file on a later run, so if the
first attempt captured the wrong values, edit `/etc/1time/env` directly and
`sudo systemctl restart 1time`.

Later deploys install the binary, the static site, the nginx config and the unit,
then restart. They never read or write `/etc/1time/env`, so a deploy cannot clear
a secret by forgetting to pass it.
