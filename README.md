# GHCR-Docker-Sync (WIP)

#### Sync your local images to GitHub's Container Registry using webhooks.

When the server recieves a webhook from GitHub with the event `package.published` it checks if the image exists locally. If so it proceeds to download the new image & restart every container using this image.

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

For more options see: `src/utils/config.ts`

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

- Implement docker secrets for `WEBHOOK_SECRET`.
- Add version control with downgrade protection.
