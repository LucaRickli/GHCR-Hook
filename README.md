# GHCR-Hook

#### Keep your local Docker images & containers in sync with GitHub's Container Registry using webhooks.

The server reacts to webhooks from GitHub with the event `package.published`. If everything checks out it proceeds to download the new image & restart every container with the same configuration it was started except for the new image.

### Limitations

- There has to be at least one Container running using the image to be reloaded.
- Currently does not support versioned images. E.g. upgrade from 1.1 to 1.2 wont work.
- If something goes wrong there is no recovery!

## Usage

### Configuration

#### Required

- WEBHOOK_SECRET (or WEBHOOK_SECRET_FILE)

> For full configuration & defaults see: [`src/utils/config.ts`](https://github.com/LucaRickli/GHCR-Hook/blob/main/src/utils/config.ts)

### Run with Docker

Create webhook secret.

```bash
echo $(openssl rand -base64 32 | tr -d '\n') > webhook.secret
```

Create `docker-compose.yml`.

```yml
version: "3.8"

secrets:
  webhook:
    file: ./webhook.secret

services:
  webhooks:
    image: ghcr.io/lucarickli/ghcr-hook
    secrets:
      - webhook
    environment:
      WEBHOOK_SECRET_FILE: /run/secrets/webhook
      # Can also be set without docker secret.
      # WEBHOOK_SECRET: ${WEBHOOK_SECRET:?WEBHOOK_SECRET is required!}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./logs:/home/logs
    ports:
      - 8000:8000
```

Start container.

```bash
docker compose up
```

### Run locally

```bash
cp example.env .env
```

> Edit `WEBHOOK_SECRET` inside `.env` to prevent attackers from accessing this endpoint!

```bash
npm i
npm run build
npm start
```

#### Development

```bash
npm run dev
npm run dev:debug # With debugging
```

## Add container to sync

1. Pull the docker image you want to sync to your server.
2. Start at least one container using this image.
3. Add a webhook to your GitHub repo.
   - Set `Payload Url` to your server.
   - Set `Webhook Secret` to your generated secret.
   - Set `Content type` to `applications/json`.
   - Select `individual events` and remove everything except `packages`.

## Todo's

- Add version control with downgrade protection.
