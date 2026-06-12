# Integration Tests

Integration tests run against a real DynamoDB table. The easiest way to run them locally is with [LocalStack](https://docs.localstack.cloud/getting-started/installation/).

## Running with LocalStack

1. Start LocalStack:

```sh
localstack start
```

2. Run the tests:

```sh
yarn test:integration
```

The test setup automatically creates the table and all GSIs on first run. Configuration is loaded from `tests/integration/localstack-env.sh` (endpoint, region, dummy credentials) via `source`.

## Running against real AWS

Set the required environment variables and run vitest directly:

```sh
AWS_REGION=us-east-1 \
TURBINE_TEST_TABLE=my-test-table \
vitest run tests/integration
```

Your environment must have valid AWS credentials (e.g. via `~/.aws/credentials`, an IAM role, or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`). The table will be created automatically if it doesn't exist, using on-demand billing.
