# hmpps-breach-notice-ui

[![repo standards badge](https://img.shields.io/endpoint?labelColor=231f20&color=005ea5&style=flat&label=MoJ%20Compliant&url=https%3A%2F%2Foperations-engineering-reports-prod.cloud-platform.service.justice.gov.uk%2Fapi%2Fv1%2Fcompliant_public_repositories%2Fendpoint%2Fhmpps-breach-notice-ui&logo=data:image/png;base64,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)](https://operations-engineering-reports-prod.cloud-platform.service.justice.gov.uk/public-report/hmpps-breach-notice-ui)
[![CircleCI](https://circleci.com/gh/ministryofjustice/hmpps-breach-notice-ui/tree/main.svg?style=svg)](https://circleci.com/gh/ministryofjustice/hmpps-breach-notice-ui)

## Get started

### Pre-requisites

You'll need to install:

* [Node 20.x](https://nodejs.org/download/release/latest-v20.x)*
* [Docker](https://www.docker.com/)
* [Java 21](https://www.oracle.com/uk/java/technologies/downloads/)**

*If you're already using [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm), run:
`nvm install --latest-npm` at the project root to install the correct Node version automatically.


**To simplify switching between Java versions it is advisable to use [sdkman](https://sdkman.io/install)

### Dependencies

Install NPM package dependencies (from the root of the project):

First - Create a .env file in the root of the project (only on first run copy the example env file by running the following command)

```shell
cp .env.example .env
```

Then, to run the service locally with dependencies in WireMock:

```shell
npm run start:dev
```

Open http://localhost:3000 in your browser.

### Running the API locally

To start the service with a locally running instance of [hmpps-breach-notice-api](https://github.com/ministryofjustice/hmpps-breach-notice-api) on port 8080,
add the following to your `.env` file:

```properties
HMPPS_AUTH_URL=http://localhost:9090/auth
BREACH_NOTICE_API_URL=http://localhost:8080
```

### Integrate with dev services running on MOJ Cloud Platform

Alternatively, you can integrate your local UI with the dev/test services deployed on MOJ Cloud Platform.
This removes the need for using Docker.

Create a `.env` file at the root of the project:

```properties
NODE_ENV=development
ENVIRONMENT=dev
REDIS_ENABLED=false
HMPPS_AUTH_URL=https://sign-in-dev.hmpps.service.justice.gov.uk/auth
MANAGE_USERS_API_URL=https://manage-users-api-dev.hmpps.service.justice.gov.uk

```

Run the following to grab client credentials from the dev namespace:

```shell
kubectl -n hmpps-breach-notice-dev get secret hmpps-breach-notice-ui -o json \
| jq -r '.data | map_values(@base64d) | to_entries[] | "\(.key)=\(.value)"' \
| grep CLIENT >> .env
```

Then, start the UI service:

```shell
npm run start:dev
```

## Formatting

### Check formatting

`npm run lint`

### Fix formatting

`npm run lint:fix`

### Intellij Config

For formatting nunjucks files it is recommended to install the [Twig Plugin for IntelliJ](https://plugins.jetbrains.com/plugin/7303-twig) and [configure a filetype association](https://www.jetbrains.com/help/idea/creating-and-registering-file-types.html) for *.njk files

To automatically format TypeScript files go to settings, enable the ESLint "fix on save" setting in IntelliJ.
See [Fix problems automatically on save](https://www.jetbrains.com/help/idea/eslint.html#ws_eslint_configure_run_eslint_on_save)


## Testing

### Run unit tests

`npm run test`

### Running integration tests

To run the Cypress integration tests locally:

```shell
# Start the UI in test mode
npm run start-feature:dev

# Run the tests in headless mode:
npm run int-test

# Or, run the tests with the Cypress UI:
npm run int-test-ui
```

### Dependency Checks

The template project has implemented some scheduled checks to ensure that key dependencies are kept up to date.
If these are not desired in the cloned project, remove references to `check_outdated` job from `.circleci/config.yml`

### Logging in with a test user

Once the application is running you should then be able to login with:

username: AUTH_USER
password: password123456

To request specific users and roles then raise a PR
to [update the seed data](https://github.com/ministryofjustice/hmpps-auth/blob/main/src/main/resources/db/dev/data/auth/V900_3__users.sql)
for the in-memory DB used by Auth

### Run linter

* `npm run lint` runs `eslint`.
* `npm run typecheck` runs the TypeScript compiler `tsc`.

### Run unit tests

`npm run test`

### Running integration tests

For local running, start a wiremock instance by:

`docker compose -f docker-compose-test.yml up`

Then run the server in test mode by:

`npm run start-feature` (or `npm run start-feature:dev` to run with auto-restart on changes)

And then either, run tests in headless mode with:

`npm run int-test`

Or run tests with the cypress UI:

`npm run int-test-ui`
