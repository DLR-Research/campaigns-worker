export namespace AWS_OPTS {
  const region: string
  namespace credentials {
    const accessKeyId: string
    const secretAccessKey: string
  }
}
export function sql(query: string): ExecuteStatementCommand
export const client: RDSDataClient
import { ExecuteStatementCommand } from '@aws-sdk/client-rds-data/dist-types/commands/ExecuteStatementCommand'
import { RDSDataClient } from '@aws-sdk/client-rds-data/dist-types/RDSDataClient'
