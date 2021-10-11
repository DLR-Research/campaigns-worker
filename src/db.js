import { ExecuteStatementCommand } from '@aws-sdk/client-rds-data'

export const AWS_OPTS = {
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
}

export const sql = query =>
  new ExecuteStatementCommand({
    database: AWS_DB_NAME,
    sql: query,
    resourceArn: AWS_AURORA_RESOURCE_ARN,
    secretArn: AWS_AURORA_SECRET_ARN
  })
