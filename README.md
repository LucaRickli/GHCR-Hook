# GHCR-Docker-Sync (WIP)

#### Sync your local images to GitHub's Container Registry using webhooks.

The server reacts to webhooks from GitHub with the event `package.published`. If everything checks out it proceeds to download the new image & restart every container using this image.

### Limitations

- The docker image has to be stored locally. It wont download unkown images.
- There has to be at least one Container running using this image.
- Currently does not support versioned images. E.g. upgrade from 1.5.7 to 1.5.8 wont work.
- If something goes wrong there is no recovery!

## Usage

#### Configuration

```bash
cp example.env .env
```

Options

| Value          | Default              | Info                  |
| -------------- | -------------------- | --------------------- |
| WEBHOOK_SECRET | undefined            | Required!             |
| WEBHOOK_PATH   | /                    | Webhooks handler path |
| SOCKET_PATH    | /var/run/docker.sock | Docker unix socket    |
| DEBUG          | undefined            | see `package.json`    |
| PORT           | 8000                 |                       |

> For full configuration & defaults see: `src/utils/config.ts`

### Using Docker

```bash
docker compose up -d
```

### Without docker

#### Install

```bash
npm i
```

#### Build

```bash
npm run build
```

#### Run Build

```bash
npm start
```

#### Development

```bash
npm run dev
# With debugging
npm run dev:debug
```

## Todo's

- Implement docker secrets for `WEBHOOK_SECRET` as `WEBHOOK_SECRET_FILE`.
- Add fallback process to handle failure recovery.
- Add version control with downgrade protection.
