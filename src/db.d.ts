export namespace AWS_OPTS {
  const region: strsing
  namespace credentials {
    const accessKeyId: string
    const secretAccessKey: string
  }
}
export function sql(query: string): ExecuteStatementCommand
import { ExecuteStatementCommand } from '@aws-sdk/client-rds-data/dist-types/commands/ExecuteStatementCommand'
