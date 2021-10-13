import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data'

interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
}

interface AwsOpts {
  region: string
  credentials: AwsCredentials
}

export const AWS_OPTS = {
  // @ts-ignore
  region: AWS_REGION,
  credentials: {
    // @ts-ignore
    accessKeyId: AWS_ACCESS_KEY_ID,
    // @ts-ignore
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
} as AwsOpts

export const sql = (query: string) =>
  new ExecuteStatementCommand({
    // @ts-ignore
    database: AWS_DB_NAME,
    sql: query,
    // @ts-ignore
    resourceArn: AWS_AURORA_RESOURCE_ARN,
    // @ts-ignore
    secretArn: AWS_AURORA_SECRET_ARN
  })

export const db_client = () => new RDSDataClient(AWS_OPTS)
